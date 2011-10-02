/* ChannelVision A0316 iPod Dock module for CommandFusion
===============================================================================

AUTHOR:		Jarrod Bell, CommandFusion
CONTACT:	support@commandfusion.com
URL:		https://github.com/CommandFusion/
VERSION:	v1.0.0
LAST MOD:	Tuesday, 27 September 2011

=========================================================================
HELP:

TODO

=========================================================================
*/

// ======================================================================
// Helper functions for String and Number formats
// ======================================================================
String.prototype.toHexString = function () {
    var str = this;
	var hex = '';
    for (var i = 0; i < str.length; i++) {
        hex += ("00"+str.charCodeAt(i).toString(16)).slice(-2).toUpperCase() + " ";
	}
    return hex;
};

Number.prototype.toByteString = function (num) {
	var x = this;
	var str = "";
	var i = num;
	for (var i = num - 1; i >= 0; i--) {
		str = String.fromCharCode(x & (255)) + str;
		x = x >> 8;
	}
	return str;
};

// ======================================================================
// Global Object
// ======================================================================
var ChannelVisionDock = function (params) {
	var self = {
		systemName:		"",		// The name of the system in the GUI
		feedbackName:	"",		// The name of the feedback item in the GUI
		cmdPrefix:		"A36",	// Prefix to use for all outgoing commands
		iPodName:		"",		// The name of the connected iPod
		artworkFormats:	[],		// Array to store all the artwork formats supported by the iPod
		artworkFormatID: null,	// Format of the artwork to get
		artworkData:	{		// Storage for the artwork pixel data
			packetID:		0,	// Current packet number for the incoming artwork data (split across many packets)
			width:			0,	// Image width
			height:			0,	// Image height
			formatID:		0,	// Format specifier for the pixel data, matches a format ID in the artworkFormats array
			byteCount:		0,	// The number of bytes expected for the pixel data (based on format ID bits per pixel and image size)
			rowSize:		0,	// Bitmap data row size
			data:			"",	// The actual pixel data
		},
		playingIndex:	0,		// The index of the currently playing track
		trackLength:	0,		// Length of the currently playing track in seconds
		lastDBRequest:	null,	// The last database type to be requested (Artist, Album, Playlist, etc)
		msgQueue:		[],		// The queue of outgoing messages (Message objects)
		queueDelay:		300,	// The delay for the setInterval
		queueInterval:	null,	// The interval object returned from setInterval calls
		waitingReplies:	0,		// The number of replies we are still waiting for from last request
		lastMessage:	null,	// The last message object that was sent (OutgoingMsg object)
		lastTime:		null,	// The time that the last message was sent (Date.now)
		listItems:		[],		// List items array to reduce number of CF.listAdd calls
		listCount:		0,		// The number of list items total to be returned
		retryCount:		0,		// Number of times a failed message has been retried to send (max of 3 times)
		joins:			{
			artist:			"s1",
			album:			"s2",
			track:			"s3",
			elapsed:		"s4",
			trackLength:	"s5",
			artwork:		"s6",
			iPodName:		"s7",
			iPodVersion:	"s8",
			iPodModel:		"s9",
			shuffleString:	"s10",
			repeatString:	"s11",
			isIpodDocked:	"d1",
			playbackState:	"d2",
			shuffleState:	"d3",
			repeatState:	"d4",
			menuList:		"l1",
			progress:		"a1"
		},
		artistData:		[],		// Array of all artist data from the connected iPod
		genreData:		[],		// Array of all genre data from the connected iPod
		playlistData:	[],		// Array of all playlist data from the connected iPod
		playlistFlag:	false,	// Flag to say if we have the complete list of playlists from the device stored
		artistFlag:		false,	// Flag to say if we have the complete list of artists from the device stored
		genreFlag:		false,	// Flag to say if we have the complete list of genres from the device stored
		artistPos:		0,		// Last scroll position for artist list
		artistLetters:	[],		// Array to store the positions for each alphabar letter
		protocolRegexFix:	/^\x23{2,}[\s\S]{1,35}/,	// Regular expression used to match then fix a bug in the notification protocol
		listLetterFilter:	/^(?:the |a )?(.)/i,		// Regular expression used to filter out artists beginning with "The " or "A " and use the next word as their title letter
		loadingInterval: null,	// Interval used for animating the loading spinner
		lastListLetter:	"#",	// First letter of the last item added to the list
		artRocker:		null,
		//bitmapHeader55:		"\x42\x4D\x58\x18\x00\x00\x00\x00\x00\x00\x46\x00\x00\x00\x38\x00\x00\x00\x37\x00\x00\x00\x37\x00\x00\x00\x01\x00\x10\x00\x03\x00\x00\x00\x12\x18\x00\x00\x12\x0B\x00\x00\x12\x0B\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xF8\x00\x00\xE0\x07\x00\x00\x1F\x00\x00\x00\x00\x00\x00\x00"
	};

	// Every incoming message is split up and converted to a Message object
	var Message = function () {
		this.ack = 0;
		this.lingo = 0;			// Stored as hex
		this.comID = 0;			// Stored as hex
		this.message = "";
		this.length = 0;		// Stored as decimal

		this.processLingo = function () {
			switch (this.lingo) {
				case 0x21: // Special Lingo
					this.processLingoSpecial();
					break;
				case 0x00: // General Lingo
					this.processLingoGeneral();
					break;
				case 0x04: // Extended Interface Lingo
					this.processLingoExtended();
					break;
			}
		};

		this.processLingoGeneral = function() {
			switch (this.comID) {
				case 0x04: // UI Remote Mode
					if (this.message == 0x01) {
						// UI Remote Mode ON
					} else {
						// UI Remote Mode OFF
					}
					break;
				case 0x08: // iPod Name
					CF.setJoin(self.joins.iPodName, decodeURIComponent(escape(this.message.replace(/\x00/,""))));
					CF.log("iPod Name: " + this.message);
					break;
				case 0x0A: // iPod Software Version
					CF.setJoin(self.joins.iPodVersion, this.message.charCodeAt(0) + "." + this.message.charCodeAt(1) + "." + this.message.charCodeAt(2));
					CF.log("iPod Software Version: " + this.message.toHexString());
					break;
				case 0x0E: // iPod Model Number
					CF.setJoin(self.joins.iPodModel, this.message.replace(/\x00/,""));
					CF.log("iPod Model Number: " + this.message.toHexString());
					break;
				case 0x10: // Lingo Protocol Version
					CF.log("Lingo Protocol Version: " + this.message.toHexString());
					break;
			}
		};

		this.processLingoSpecial = function() {
			switch (this.comID) {
				case 0x00:
					// Command Received OK
					CF.log("Acknowledged!");
					break;
				case 0x21:
					// iPod Removed / Not connected
					CF.log("iPod NOT Connected!");
					
					if (self.artRocker !== null) {
						self.artRocker.stop();
					}

					CF.setJoins([
						{join: self.joins.isIpodDocked, value: 0},
						{join: self.joins.iPodName, value: "iPod Not Docked"},
						{join: self.joins.iPodVersion, value: ""},
						{join: self.joins.iPodModel, value: ""},
						{join: self.joins.artist, value: ""},
						{join: self.joins.track, value: ""},
						{join: self.joins.album, value: ""},
						{join: self.joins.elapsed, value: ""},
						{join: self.joins.trackLength, value: ""},
						{join: self.joins.artwork, value: ""},
						{join: self.joins.playbackState, value: 0},
						{join: self.joins.shuffleState, value: 0},
						{join: self.joins.repeatState, value: 0},
						{join: self.joins.progress, value: 0},
						{join: self.joins.shuffleString, value: ""},
						{join: self.joins.repeatString, value: ""},
						{join: self.joins.menuList, value: "0x"},
						{join: self.joins.listTitle, value: ""},
					]);
					// Hide the alphabar
					CF.setProperties({join: self.joins.alphabar, opacity: 0});

					self.hideMenu();

					break;
				case 0x22:
					// iPod Inserted / Connected
					CF.log("iPod Connected!");
					CF.setJoin(self.joins.isIpodDocked, 1);

					self.showMenu();
					
					// Enter extended mode by default
					self.enterExtendedMode();

					self.getIpodDetails();

					// Start getting full notifications from the dock
					self.setNotifications("full");
					//self.setNotifications2(true);

					self.getShuffle();
					self.getRepeat();
					self.getCurrentlyPlayingIndex();

					// Clear all existing data, as its a new iPod connection (could be same device, but might not be)
					self.playlistFlag = false;
					self.artistFlag = false;
					self.genreFlag = false;
					self.playlistData = [];
					self.artistData = [];
					self.genreData = [];
					self.artistLetters = [];

					self.getArtists();

					break;
				case 0x23: // iPod incompatible
					CF.log("iPod Incompatible!");
					break;
				case 0x24: // iPod not in extended mode
					// This means that we cannot execute advanced commands in the "Extended Interface Logic" protocol
					// Maybe want to automatically ensure we are in this mode?
					CF.log("Not in Extended Mode!");
					break;
				case 0x25: // NACK
					CF.log("Uh Oh! NACK! ignored!");
					break;
			}
		};

		this.processLingoExtended = function() {
			switch (this.comID) {
				case 0x0D: // Indexed playing track info
					CF.log("Indexed playing track info: " + this.message.toHexString());
					// 07 00 00 00 01 00 01 00 01 00 02 00 01 00 03 00 01 00 04 00 01 
					// First byte defines how many artwork formats are available for the track?? Ignore
					// Go through the remaining bytes, in groups of 4
					var i;
					self.artworkFormatID = null;
					for (i = this.message.length - 1; i >= 0; i -= 4) {
						self.artworkFormatID = ((this.message.charCodeAt(i-3) << 8) | this.message.charCodeAt(i-2));
						var imageCount = ((this.message.charCodeAt(i-1) << 8) | this.message.charCodeAt(i));
						if (imageCount > 0) {
							break;
						}
					}
					if (self.artworkFormatID !== null) {
						CF.log("Format ID to get: " + self.artworkFormatID);
						// Get Track Artwork times for the format
						self.buildMsg("\x5B" + self.playingIndex.toByteString(4) + self.artworkFormatID.toByteString(2));
					}
					break;
				case 0x0F: // Return artwork formats
					CF.log("Return artwork formats: " + this.message);
					// iPhone formats:
					// 00 00 02 01 40 01 40 00 01 02 00 F0 00 F0 00 02 02 00 80 00 80 00 03 02 00 50 00 50 00 04 02 00 37 00 37
					// break down:

					// 00 00 = Artwork format ID
					// 02 = RGB 565 color, little-endian, 16 bpp
					// 01 40 = image width (320 pixels)
					// 01 40 = image height (320 pixels)
					
					// 00 01 = Artwork format ID
					// 02 = RGB 565 color, little-endian, 16 bpp
					// 00 F0 = image width (240 pixels)
					// 00 F0 = image height (240 pixels)
					
					// 00 02 = Artwork format ID
					// 02 = RGB 565 color, little-endian, 16 bpp
					// 00 80 = image width (128 pixels)
					// 00 80 = image height (128 pixels)

					// 00 03 = Artwork format ID
					// 02 = RGB 565 color, little-endian, 16 bpp
					// 00 50 = image width (80 pixels)
					// 00 50 = image height (80 pixels)

					// 00 04 = Artwork format ID
					// 02 = RGB 565 color, little-endian, 16 bpp
					// 00 37 = image width (55 pixels)
					// 00 37 = image height (55 pixels)

					var formats = this.message.match(/[\s\S]{1,7}/g);
					for (var i = 0; i < formats.length; i++) {
						var newFormat = new ArtworkFormat();
						newFormat.ID = ((formats[i].charCodeAt(0) << 8) | formats[i].charCodeAt(1));
						newFormat.formatCode = formats[i].charCodeAt(2);
						newFormat.width = ((formats[i].charCodeAt(3) << 8) | formats[i].charCodeAt(4));
						newFormat.height = ((formats[i].charCodeAt(5) << 8) | formats[i].charCodeAt(6));
						self.artworkFormats.push(newFormat);
					}

					break;
				case 0x11: // Return track artwork data
					CF.log("Return track artwork data: " + this.message.toHexString());
					// Example:
					// 00 00 02 00 37 00 37 00 00 00 00 00 37 00 37 00 00 00 6E 
					// 00 00 = Packet number
					// 02 = Pixel Format Identifier
					// 00 37 = width (55)
					// 00 37 = height (55)
					// 00 00 = top X (0)
					// 00 00 = top Y (0)
					// 00 37 = bottom X (55)
					// 00 37 = bottom Y (55)
					// 00 00 00 6E = Row Size (110) = ((BPP * Width) / 32) * 4 (http://en.wikipedia.org/wiki/BMP_file_format#Pixel_storage)
					// Remaining data below = image data:
					// AF BC 94 D5 54 DE 13 DE 55 DE 14 DE 54 DE D3 CD 6A 79 AA 81 70 B4 71 BC AB 79 EF 9A AF 92 6E 92 EF 9A AF 92 AF 92 AD 92 6D 92 2D 93 6E A3 95 DE 54 DE 14 D6 95 DE 54 DE 12 D6 93 D6 94 D6 95 E6 D7 E6 18 E7 1A EF 5B EF 5B EF 5A EF 5A EF 18 EF 59 EF 17 E7 D6 E6 D7 E6 D7 E6 18 EF 17 E7 18 E7 18 E7 18 E7 18 EF 19 EF D9 EE 16 DE EF A3 2E B4 52 D5 2F B4 EE B3 30 BC F1 C4 B0 BC 92 CD EA 79 AB 79 6C 92 ED 81 AC 81 2F 93 2E 8A 30 9B AF 92 EE 9A AC 8A 6C 8A AC 8A ED 92 AF AB D6 D5 EF AB F2 C4 16 D6 18 EF D8 EE 5A F7 D6 CD 55 C5 57 DE D8 EE D6 E6 D7 DE 54 C5 D7 D5 58 DE 59 EF 19 EF 19 EF 18 E7 D7 E6 16 E7 17 EF 17 E7 18 EF 59 EF 18 F7 19 F7 5A F7 19 EF 57 EE B1 C4 6E B4
					// Only the first packet (00 00) contains the image description info.
					// Subsequent packets are just the packet number followed by image data.
					// Max length = 244 per packet (F4)
					var packetID = ((this.message.charCodeAt(0) << 8) | this.message.charCodeAt(1));
					self.artworkData.packetID = packetID;
					if (packetID == 0) {
						self.artworkData.formatID = this.message.charCodeAt(2);
						self.artworkData.width = ((this.message.charCodeAt(3) << 8) | this.message.charCodeAt(4));
						self.artworkData.height = ((this.message.charCodeAt(5) << 8) | this.message.charCodeAt(6));
						self.artworkData.rowSize = parseInt(((this.message.charCodeAt(15) << 24) | (this.message.charCodeAt(16) << 16) | (this.message.charCodeAt(17) << 8) | this.message.charCodeAt(18)));
						self.artworkData.data = "";
						// Calculate the bytes for the data based on the format code's bits per pixel and the image size
						for (var i = 0; i < self.artworkFormats.length; i++) {
							if (self.artworkFormats[i].ID == self.artworkData.formatID) {
								switch (self.artworkFormats[i].formatCode) {
									case 1:
										self.artworkData.byteCount = (self.artworkData.width * self.artworkData.height * 2) / 8;
										break;
									case 2:
									case 3:
										self.artworkData.byteCount = (self.artworkData.width * self.artworkData.height * 16) / 8;
										break;
								}
								break;
							}
						}
						self.artworkData.data +=  this.message.substr(19);
					} else {
						self.artworkData.data +=  this.message.substr(2);
					}

					//CF.log("expected bytes: " + self.artworkData.byteCount + ", current bytes: " + self.artworkData.data.length);

					// Check if we have all the expected pixel data
					if (self.artworkData.byteCount == self.artworkData.data.length) {
						// All data received, now pass the data to a HTTP web server to generate the image and set the serial join to point to this URL
						CF.setJoin(self.joins.artwork, "http://127.0.0.1:12345/getartwork");
					}
					break;
				case 0x19: // Return number categorized DB records
					var count = parseInt(((this.message.charCodeAt(0) << 24) | (this.message.charCodeAt(1) << 16) | (this.message.charCodeAt(2) << 8) | this.message.charCodeAt(3)));
					self.listCount = count;
					switch (self.lastDBRequest) {
						case 0x01: // Playlists
							//CF.log("Playlist Count: " + count);
							CF.setJoin(self.joins.listTitle, "Playlists");
							self.playlistFlag = false;
							break;
						case 0x02: // Artists
							//CF.log("Artist Count: " + count);
							CF.setJoin(self.joins.listTitle, "Artists");
							self.artistFlag = false;
							break;
						case 0x03: // Albums
							//CF.log("Album Count: " + count);
							CF.setJoin(self.joins.listTitle, "Albums");
							break;
						case 0x04: // Genres
							//CF.log("Genre Count: " + count);
							CF.setJoin(self.joins.listTitle, "Genres");
							self.genreFlag = false;
							break;
						case 0x05: // Tracks
							//CF.log("Track Count: " + count);
							CF.setJoin(self.joins.listTitle, "Tracks");
							break;
					}
					
					// Clear the list first
					CF.listRemove(self.joins.menuList);
					self.lastListLetter = "#";
					var blockSize = 50, items = count;

					// Request the actual DB records, in groups of 50 (0x32)
					for (var i = 0; i < count; i += blockSize) {
						// delay each sending to ensure we grab all from the first request to begin with
						//setTimeout(function(x){self.buildMsg("D" + String.fromCharCode(self.lastDBRequest) + x.toByteString(4) + ((count < blockSize) ? count.toByteString(4) : blockSize.toByteString(4)));}, delay, i);
						//delay += delay;
						var num = ((items < blockSize) ? items : blockSize)
						self.buildMsg("D" + String.fromCharCode(self.lastDBRequest) + i.toByteString(4) + num.toByteString(4), num);
						items -= blockSize;
					}

					break;
				case 0x1B: // Return categorized DB records
					// First 4 bytes are the list index (zero based)
					var index = parseInt(((this.message.charCodeAt(0) << 24) | (this.message.charCodeAt(1) << 16) | (this.message.charCodeAt(2) << 8) | this.message.charCodeAt(3))) + 1;
					// Remaining bytes are the record name string (removing null byte terminators)
					var recordName = decodeURIComponent(escape(this.message.substr(4).replace(/\x00/, "")));
					// Get the first letter/number of the item if it is an artist
					if (self.lastDBRequest == 0x02) {
						// Ignore chars for items that start with "A" or "The"
						var newLetter = recordName.match(self.listLetterFilter);
						if (newLetter !== null) {
							newLetter = newLetter[1];
							if (newLetter === undefined) {
								newLetter = recordName.substr(0, 1);
							}
							// Check if the first letter is a number
							if (!isNaN(newLetter)) {
								// Use hash symbol as title for all numeric items
								newLetter = "#";
							}
							if (newLetter != self.lastListLetter) {
								// Add a title item
								var newTitle = {"s1": newLetter, title: true};
								// Push the title to the artist list array
								self.artistData.push(newTitle);
								self.listItems.push(newTitle);
								self.lastListLetter = newLetter;
								self.artistLetters[newLetter] = self.artistData.length - 1;
							}
						}
					}
					var newItem = {"s1": recordName, "d1": { tokens: {"index": index} }, "d2": { tokens: {"index": index} }};
					// Push the item to an array instead of adding each list item separately
					switch (self.lastDBRequest) {
						case 0x01: // Playlists
							self.playlistData.push(newItem);
							break;
						case 0x02: // Artists
							self.artistData.push(newItem);
							break;
						case 0x04: // Genres
							self.genreData.push(newItem);
							break;
					}
					self.listItems.push(newItem);
					//CF.log("Return DB Record: " + index + ". " + recordName + ", Array length: " + self.listItems.length);
					// When all replies have come in, add them to the list
					if (index % self.lastMessage.numReplies == 0 || index == self.listCount) {
						CF.listAdd(self.joins.menuList, self.listItems);
						// Clear the list of replies, ready for the next lot
						self.listItems = [];
					}
					if (index == self.listCount) {
						switch (self.lastDBRequest) {
							case 0x01: // Playlists complete
								self.playlistFlag = true;
								break;
							case 0x02: // Artists complete
								self.artistFlag = true;
								break;
							case 0x04: // Genres complete
								self.genreFlag = true;
								break;
						}
						loading.stop();
					}
					break;
				case 0x1D: // Return play status
					CF.log("Return play status: " + this.message.toHexString());
					// Example Reply: 00 02 A9 A1 00 02 3C B4 01
					// First 4 bytes = track length in milliseconds
					// Next 4 bytes = time elapsed in milliseconds
					// Last byte = playing status (00 = Stopped, 01 = Playing, 02 = Paused)
					if (this.message[8] == 0x00) {
						// Stopped, clear all currently playing joins
						self.updateNowPlaying(0,0,0);
						if (self.artRocker !== null) {
							self.artRocker.stop();
						}
					} else {
						var length = parseInt(((this.message.charCodeAt(0) << 24) | (this.message.charCodeAt(1) << 16) | (this.message.charCodeAt(2) << 8) | this.message.charCodeAt(3)));
						var elapsed = parseInt(((this.message.charCodeAt(4) << 24) | (this.message.charCodeAt(5) << 16) | (this.message.charCodeAt(6) << 8) | this.message.charCodeAt(7)));
						self.updateNowPlaying(this.message.charCodeAt(8),elapsed,length);
						if (self.artRocker !== null) {
							self.artRocker.stop();
						}						
						self.artRocker = new Rocker(self.joins.artwork, 4, 40, self.joins.artMask);
					}
					break;
				case 0x1F: // Return currently playing track index
					CF.log("Return currently playing track index: " + this.message.toHexString());
					var trackID = parseInt(((this.message.charCodeAt(0) << 24) | (this.message.charCodeAt(1) << 16) | (this.message.charCodeAt(2) << 8) | this.message.charCodeAt(3)));
					self.playingIndex = trackID;
					self.getNowPlaying(trackID);
					break;
				case 0x21: // Return currently playing track title
					CF.setJoin(self.joins.track, this.message.replace(/\x00/,""));
					break;
				case 0x23: // Return currently playing artist name
					CF.setJoin(self.joins.artist, this.message.replace(/\x00/,""));
					break;
				case 0x25: // Return currently playing album name
					CF.setJoin(self.joins.album, this.message.replace(/\x00/,""));
					self.getCurrentArtwork();
					break;
				case 0x27: // Play Status Change Notification
					switch (this.message.charCodeAt(0)) {
						case 1:
							// New track ID
							var trackID = parseInt(((this.message.charCodeAt(1) << 24) | (this.message.charCodeAt(2) << 16) | (this.message.charCodeAt(3) << 8) | this.message.charCodeAt(4)));
							self.playingIndex = trackID;
							// Get the info for the new track
							//self.getIndexedPlayingTrackInfo(trackID);
							self.getNowPlaying(trackID);
							break;
						case 7:
							// Elapsed time seconds update
							var seconds = parseInt(((this.message.charCodeAt(1) << 24) | (this.message.charCodeAt(2) << 16) | (this.message.charCodeAt(3) << 8) | this.message.charCodeAt(4)));
							self.updateNowPlaying(1, seconds * 1000);
							break;
						case 6:
							// Stopped
							//self.updateNowPlaying(0, 0, 0);
						case 4:
							// ignore millisecond elapsed updates
							break;
						default:
							CF.log("Other Play Status Change Notification: " + this.message.toHexString());
					}
					// Ignore notifications for message queue handling
					self.waitingReplies++;
					break;
				case 0x2B: // Return track artwork times
					CF.log("Return track artwork times: " + this.message.toHexString());
					self.buildMsg("\x5C" + self.playingIndex.toByteString(4) + self.artworkFormatID.toByteString(2) + this.message);
					break;
				case 0x2D: // Return Shuffle
					CF.log("Return Shuffle: " + this.message.toHexString());
					var state = this.message.charCodeAt(0);
					CF.setJoin(self.joins.shuffleState, state);
					if (state == 0) {
						CF.setJoin(self.joins.shuffleString, "off");
					} else if (state == 1) {
						CF.setJoin(self.joins.shuffleString, "songs");
					} else if (state == 2) {
						CF.setJoin(self.joins.shuffleString, "album");
					}
					break;
				case 0x30: // Return Repeat
					CF.log("Return Repeat: " + this.message.toHexString());
					var state = this.message.charCodeAt(0);
					CF.setJoin(self.joins.repeatState, state);
					if (state == 0) {
						CF.setJoin(self.joins.repeatString, "none");
					} else if (state == 1) {
						CF.setJoin(self.joins.repeatString, "one");
					} else if (state == 2) {
						CF.setJoin(self.joins.repeatString, "all");
					}
					break;
				case 0x36: // Return number of playing tracks
					CF.log("Return number of playing tracks: " + this.message.toHexString());
					break;
			}
		};
	};

	// Outoing message object, stores the message the number of replies the message expects
	var OutgoingMsg = function () {
		this.numReplies = 0;
		this.msg = "";
	};

	// Object to store each artwork format that the device supports
	var ArtworkFormat = function () {
		this.ID = 0;
		this.formatCode = 0;
		this.width = 0;
		this.height = 0;
	};

	try {
		// Detect when the socket connects/disconnects (via CF.watch)
		self.onConnectionChange = function (system, connected, remote) {
			if (connected) {
				// Connected!
				CF.log(self.systemName + " Connected");

				CF.setJoin(self.joins.connected, 1);

				// Get the connection status, which will trigger other requests if a device is found
				self.isDevicePluggedIn();

			} else {
				// Disconnected!
				CF.log(self.systemName + " Disconnected");
				CF.setJoin(self.joins.connected, 0);
			}
			self.hideMenu();
			loading.stop();
		};

		// Detect incoming data matches (via CF.watch)
		self.onIncomingData = function (theSystem, matchedString) {
			try {
				// Byte 0 = Acknowledgement (0x23)
				// Byte 1 = Message Length (minimum 3 bytes) = n
				// Byte 2 = iPod Lingo
				// Byte 3 = COM ID
				// Byte 4 = Message From iPod
				// ..	  = Continued message (if message length > 1)
				// Byte 4 + n = Message From iPod (last byte of the message)
				// Byte 4 + n + 1 = Checksum
				// Byte 4 + n + 2 = 0x0D
				// Byte 4 + n + 3 = 0x0A

				//CF.log("Received: " + matchedString.toHexString());
				var newMsg = new Message();
				// Check if this is the start of a response, or a continued list response
				if (matchedString[0] != "#") {
					//CF.log("Continued Response!");
					matchedString = "\x23" + matchedString; // Add an ack byte (hash) to the beginning to treat it like a normal response (easier to parse)
				}
				// Fix a bug in the protocol where messages are sent with multiple \x23 ack bytes at the beginning
				if (self.protocolRegexFix.test(matchedString)) {
					matchedString = matchedString.replace(/^\x23+/g, "\x23");
				}
				newMsg.ack = matchedString[0];
				newMsg.length = parseInt(matchedString.charCodeAt(1));
				if (matchedString.length != (newMsg.length + 5) && matchedString.charCodeAt(2) == 0) {
					// Buggy reply (happens every now and then, poorly written firmware in this dock)
					// Lets drop the 3rd byte if its a 00.
					// eg. 23 0D 00 04 00 23 42 72 61 6E 64 20 4E 65 77 00 9B 0D 0A 
					CF.log("INCORRECT LENGTH REPLY, FIXING IT....");
					matchedString = matchedString.substr(0, 2) + matchedString.substr(3);
					CF.log("FIXED: " + matchedString.toHexString());
				}
				newMsg.lingo = matchedString.charCodeAt(2);
				if (newMsg.lingo == 0x04) {
					// Extended lingo, byte order changes slightly because commID is now 2 bytes
					newMsg.comID = ((matchedString.charCodeAt(3) << 8) | matchedString.charCodeAt(4));
					newMsg.message = matchedString.substr(5, newMsg.length - 3);
				} else {
					// Other lingo, commID is 1 byte
					newMsg.comID = matchedString.charCodeAt(3);
					newMsg.message = matchedString.substr(4, newMsg.length - 2).replace(/\x00/g,"").trim();
				}

				newMsg.processLingo();
				
				//CF.log("Message: " + newMsg.message.toHexString());

			} catch (e) {
				CF.log("EXCEPTION: " + e.message);
			}

			self.waitingReplies--;
		};

		// Request status of the plugged in iPod/iPhone/etc
		self.isDevicePluggedIn = function () {
			self.buildMsg(" ", 1);
		};

		/**
		 * Function: Setup Notifications from the dock
		 * "limited" notifications is buggy because it returns 0x23 multiple times in the first few bytes.
		 * Recommended to only use "full" or "off".
		 * @Param mode {string}
		 *		The notification mode to use. Possible values are: off, full, limited.
		 */
		self.setNotifications = function (mode) {
			switch (mode) {
				case "off":
					self.buildMsg("\x5D\x00");
					break;
				case "limited":
					self.buildMsg("\x5D\x02");
					break;
				default: // full
					self.buildMsg("\x5D\x01");
					break;
			}
		};
		self.setNotifications2 = function (state) {
			switch (state) {
				case true:
					self.buildMsg("J\x01");
					break;
				default: // false
					self.buildMsg("J\x00");
					break;
			}
		};

		// Enter Extended UI mode so that we can send "Extended Lingo" commands
		self.enterExtendedMode = function () {
			self.buildMsg("'", 1);
		};

		// Exit Extended UI mode, then can no longer send "Extended Lingo" commands
		self.exitExtendedMode = function () {
			self.buildMsg("(", 1);
		};

		// Get the name, version and model of the connected iPod
		self.getIpodDetails = function () {
			self.buildMsg(")", 1); // Get Name
			self.buildMsg(",", 1); // Get Version
			self.buildMsg("*", 1); // Get Model
		};

		// Play/Pause
		self.playPause = function () {
			self.buildMsg("1");
			self.getPlayStatus();
		};

		// Play/Resume
		self.playResume = function () {
			self.buildMsg("5");
			self.getPlayStatus();
		};

		// Stop
		self.stop = function () {
			self.buildMsg("4");
			self.getPlayStatus();
		};

		// Begin Rewind
		self.rewind = function () {
			self.buildMsg("<");
		};

		// Begin Fast Forward
		self.forward = function () {
			self.buildMsg(";");
		};

		// Next Track
		self.nextTrack = function () {
			self.buildMsg("2");
		};

		// Prev Track
		self.prevTrack = function () {
			self.buildMsg("3");
		};

		// Next Playlist
		self.nextPlaylist = function () {
			self.buildMsg("7");
		};

		// Prev Playlist
		self.prevPlaylist = function () {
			self.buildMsg("8");
		};

		// Toggle Shuffle Modes
		self.toggleShuffle = function () {
			self.buildMsg("9");
			self.getShuffle();
		};

		// Toggle Repeat Modes
		self.toggleRepeat = function () {
			self.buildMsg(":");
			self.getRepeat();
		};

		// Request shuffle status
		self.getShuffle = function () {
			self.buildMsg("M", 1);
		};

		// Request repeat status
		self.getRepeat = function () {
			self.buildMsg("O", 1);
		};

		// Reset DB logic
		self.resetDB = function () {
			self.buildMsg("A", 1);
		};

		// Get number of playlists
		self.getPlaylistsCount = function () {
			self.lastDBRequest = 0x01;
			self.buildMsg("C\x01", 1);
		};

		// Get number of artists
		self.getArtistsCount = function () {
			self.lastDBRequest = 0x02;
			self.buildMsg("C\x02", 1);
		};

		// Get number of albums
		self.getAlbumsCount = function () {
			// Hide the alphabar
			CF.setProperties({join: self.joins.alphabar, opacity: 0});
			self.lastDBRequest = 0x03;
			self.buildMsg("C\x03", 1);
		};

		// Get number of genres
		self.getGenresCount = function () {
			self.lastDBRequest = 0x04;
			self.buildMsg("C\x04", 1);
		};

		// Get number of tracks
		self.getTracksCount = function () {
			// Hide the alphabar
			CF.setProperties({join: self.joins.alphabar, opacity: 0});
			self.lastDBRequest = 0x05;
			self.buildMsg("C\x05", 1);
		};

		// Start the process of getting artists
		self.getArtists = function () {
			if (self.artistFlag) {
				// Use the data from the artistData array
				CF.listRemove(self.joins.menuList);
				CF.listAdd(self.joins.menuList, self.artistData);
				CF.setJoin(self.joins.listTitle, "Artists");
				self.lastDBRequest = 0x02;
				// Restore saved list pos
				CF.listScroll(self.joins.menuList, self.artistPos, CF.TopPosition, false);
			} else {
				// Request all artists from device
				loading.start();
				self.resetDB();
				self.getArtistsCount();
			}
			// Show the alphabar
			CF.setProperties({join: self.joins.alphabar, opacity: 1});
		};

		// Start the process of getting playlists
		self.getPlaylists = function () {
			if (self.playlistFlag) {
				// Use the data from the playlistData array
				CF.listRemove(self.joins.menuList);
				CF.listAdd(self.joins.menuList, self.playlistData);
				CF.setJoin(self.joins.listTitle, "Playlists");
				self.lastDBRequest = 0x01;
			} else {
				// Request all playlists from device
				loading.start();
				self.resetDB();
				self.getPlaylistsCount();
			}
			// Hide the alphabar
			CF.setProperties({join: self.joins.alphabar, opacity: 0});
		};

		// Start the process of getting genres
		self.getGenres = function () {
			if (self.genreFlag) {
				// Use the data from the genreData array
				CF.listRemove(self.joins.menuList);
				CF.listAdd(self.joins.menuList, self.genreData);
				CF.setJoin(self.joins.listTitle, "Genres");
				self.lastDBRequest = 0x04;
			} else {
				// Request all genres from device
				loading.start();
				self.resetDB();
				self.getGenresCount();
			}
			// Hide the alphabar
			CF.setProperties({join: self.joins.alphabar, opacity: 0});
		};

		// Select a DB Record
		self.selectRecord = function (index) {
			var index = parseInt(index);
			// Perform more actions depending on the type of item we actually selected
			switch (self.lastDBRequest) {
				case 0x01: // Selected a playlist
					// Select the item
					loading.start();
					self.buildMsg("B" + String.fromCharCode(self.lastDBRequest) + index.toByteString(4));
					// Get the tracks now
					self.getTracksCount();
					break;
				case 0x02: // Selected an artist
					// Select the item
					loading.start();
					// Save the list scroll pos
					CF.listInfo(self.joins.menuList, function(join, count, first) {
						self.artistPos = first;
					});
					self.buildMsg("B" + String.fromCharCode(self.lastDBRequest) + index.toByteString(4));
					// Get the albums now
					self.getAlbumsCount();
					break;
				case 0x03: // Selected an album
					// Select the item
					loading.start();
					self.buildMsg("B" + String.fromCharCode(self.lastDBRequest) + index.toByteString(4));
					// Get the tracks now
					self.getTracksCount();
					break;
				case 0x04: // Selected a genre
					// Select the item
					loading.start();
					self.buildMsg("B" + String.fromCharCode(self.lastDBRequest) + index.toByteString(4));
					// Get the artists for this genre now
					self.getArtistsCount();
					break;
				case 0x05: // Selected a track
					// Select the item
					self.buildMsg("K" + index.toByteString(4));
					// Ensure the selected track starts playing
					self.playResume();
					break;
			}
		};

		self.playRecord = function (index) {
			// Select the item
			self.buildMsg("K" + index.toByteString(4));
			// Ensure the selected track starts playing
			self.playResume();
		};

		self.menuBack = function () {
			// Perform more actions depending on the type of item we actually selected
			switch (self.lastDBRequest) {
				case 0x01: // Playlist List
					// No action for back
					break;
				case 0x02: // Artist List
					// No action for back
					break;
				case 0x03: // Album List
					// Go back to artists
					self.getArtistsCount();
					break;
				case 0x04: // Genre List
					// No action for back
					break;
				case 0x05: // Track List
					// Go back to albums
					self.getAlbumsCount();
					break;
			}
		};

		self.getArtworkFormats = function () {
			self.buildMsg("Y", 1);
		};

		self.getPlayStatus = function () {
			self.buildMsg("E", 1);
		};

		self.getNumPlayingTracks = function () {
			self.buildMsg("Q", 1);
		};

		self.getCurrentlyPlayingIndex = function () {
			self.buildMsg("F", 1);
		};

		self.getIndexedPlayingTrackInfo = function (index) {
			self.buildMsg("Z"+index.toByteString(4), 1);
		};

		self.getCurrentArtwork = function () {
			//self.getArtworkFormats(); // Get the artwork formats supported by the iPod
			//self.getIndexedPlayingTrackInfo(self.playingIndex); // Get the artwork format IDs available for the current track

			// Not using artwork data from the dock, its much too slow.
			// Instead, use a web service to lookup the artwork automatically
			CF.getJoins([self.joins.artist, self.joins.album], function (joins) {
				// Look for cover art for the album
				albumart.albumSearch(joins[self.joins.album].value, joins[self.joins.artist].value, function(imageURL) {
					CF.setJoin(self.joins.artwork, imageURL);
				});
			});
		};

		self.getNowPlaying = function (trackID) {
			self.getPlayStatus();
			if (trackID == -1) {
				// No track playing, FF FF FF FF
				CF.setJoins([
					{join: self.joins.artist, value: ""},
					{join: self.joins.track, value: ""},
					{join: self.joins.album, value: ""}
				]);
				return;
			}
			self.buildMsg("H" + trackID.toByteString(4), 1); // Track artist
			self.buildMsg("I" + trackID.toByteString(4), 1); // Track album
			self.buildMsg("G" + trackID.toByteString(4), 1); // Track title
		};

		/**
		 * Function: Update Now Playing data for display
		 * @Param state {hex}
		 *		The state of playback (0x00 = Stopped, 0x01 = Playing, 0x02 = Paused)
		 * @Param elapsed {integer}
		 *		The number of milliseconds elapsed in the track so far
		 * @Param length {integer}
		 *		The length of the track in milliseconds
		 */
		self.updateNowPlaying = function (state, elapsed, length) {
			if (length === undefined) {
				length = self.trackLength;
			} else {
				self.trackLength = length;
			}

			if (elapsed !== null) {
				var elapsedString = ("00"+Math.floor((elapsed/1000) / 60)).slice(-2) + ":" + ("00"+(Math.ceil(elapsed/1000)% 60)).slice(-2);
				var lengthString = Math.floor((length/1000) / 60) + ":" + ("00"+(Math.ceil(length/1000)% 60)).slice(-2);
				CF.setJoins([
					{join: self.joins.elapsed, value: elapsedString},
					{join: self.joins.trackLength, value: lengthString},
					{join: self.joins.progress, value: (65535/length) * elapsed},
					{join: self.joins.playbackState, value: (state == 1) ? 1 : 0}
				]);
			}
		};

		self.selectArtistLetter = function(sliderVal) {
			// Calculate the letter based on the slider value (0-27)
			// To allow for better accuracy of the letter, both 0 and 1 slider values will equal "#" in the slider.
			var letter = "#";
			if (sliderVal > 1) {
				// Use ascii char code and convert to the letter (letter A = 65, B = 66, and so on)
				// We have to use parseInt here otherwise the + symbol might concatenate the numbers together, rather than add them.
				// This is because parameters may be passed as strings from tokens such as [sliderval]
				letter = String.fromCharCode(63 + parseInt(sliderVal));
			}
			CF.log("letter: " + letter + ", pos: " + self.artistLetters[letter]);
			if (self.artistLetters[letter] !== undefined) {
				CF.listScroll(self.joins.menuList, self.artistLetters[letter], CF.TopPosition, true);
			}
		};
		
		// Build the message to be sent out, and queue it (starting the queue processing if not already going)
		self.buildMsg = function (msg, numReplies) {
			var msg = self.cmdPrefix + String.fromCharCode(48+parseInt(msg.length)) + msg + "z"; // Use "z" as the checksum to ignore checksum calculation altogether :)
			CF.log("Queuing: " + msg.toHexString());
			var outgoing = new OutgoingMsg();
			outgoing.msg = msg;
			outgoing.numReplies = numReplies || 0;
			self.msgQueue.push(outgoing);
			if (self.queueInterval === null) {
				// Start queue processing because its not running yet
				self.queueInterval = setInterval(self.processQueue, self.queueDelay);
			}
		};

		// Process the queue of messages - required because the dock cannot handle data coming at it too quickly, especially when handling DB queries
		self.processQueue = function () {
			// If the queue contains messages to send, send one now
			if (self.msgQueue.length) {
				// Do not send until we get all the replies we requested.
				if (self.waitingReplies > 0) {
					// If it's taken over 2 seconds to get all replies, resend the request.
					if (Date.now() - self.lastTime > 2000) {
						CF.log("Resending: " + self.lastMessage.msg.toHexString());
						CF.send(self.systemName, self.lastMessage.msg);
						self.waitingReplies = self.lastMessage.numReplies;
						self.lastTime = Date.now();
						// Clear the list of replies just in case the failed message was a list request (prevent duplicates)
						self.listItems = [];
						// Increment the retry count
						self.retryCount++;
						// Only resend 2 times, then give up the message
						if (self.retryCount > 2) {
							self.waitingReplies = 0;
							CF.log("Gave up on message after 3 failed attempts at getting reply data: " + self.lastMessage.msg.toHexString());
							loading.stop();
						}
						return;
					}
					return;
				}
				var outgoing = self.msgQueue.shift();
				CF.log("Sending: " + outgoing.msg.toHexString());
				CF.send(self.systemName, outgoing.msg);
				self.lastMessage = outgoing;
				self.waitingReplies = outgoing.numReplies;
				self.lastTime = Date.now();
				self.retryCount = 0;
			} else {
				// Nothing in the queue, stop it (will automatically restart when we want to send another message via the buildMsg function)
				clearInterval(self.queueInterval);
				self.queueInterval = null;
			}
		};

		self.hideMenu = function () {
			CF.setProperties({join: self.joins.mainMenu, x: -430}, 0, 0.3, CF.AnimationCurveEaseOut);
		};

		self.showMenu = function () {
			// 82 = size of menu item + gap
			// 76 = width of home button
			// 40 = gap at end of menu items to point of menu bg
			// 522 = size of menu subpage
			var xPos = (82 * 3) + 40 + 76;
			CF.setProperties({join: self.joins.mainMenu, x: -522 + xPos}, 0, 0.3, CF.AnimationCurveEaseOut);
		};

		// Save params
		self.systemName = params.sytemName || "iPodDock";
		self.feedbackName = params.feedbackName || "iPodDock_Incoming";
		// Save any overwritten join strings
		if (params.joins !== undefined) {
			for (var join in params.joins) {
				self.joins[join] = params.joins[join];
			}
		}

		// Make the menu subpage visible, then use hideMenu and showMenu to control it
		CF.setJoin(self.joins.mainMenu, 1);

		// Watch the system for feedback processing
		CF.watch(CF.FeedbackMatchedEvent, self.systemName, self.feedbackName, self.onIncomingData);

		// Watch the system connection status
		CF.watch(CF.ConnectionStatusChangeEvent, self.systemName, self.onConnectionChange, true);

	} catch (e) {
		CF.log("MAIN EXCEPTION: " + e.message);
	}


	return self;
}

// ======================================================================
// Create an instance of the ChannelVision iPod Dock object
// ======================================================================
var iPodDock, albumart;
CF.userMain = function () {
	iPodDock = new ChannelVisionDock({
		systemName: "iPodDock",
		feedbackName: "iPodDock_Incoming",
		joins: {
			connected:		"d10",
			artist:			"s11",
			album:			"s12",
			track:			"s13",
			elapsed:		"s14",
			trackLength:	"s15",
			artwork:		"s16",
			iPodName:		"s17",
			iPodVersion:	"s18",
			iPodModel:		"s19",
			shuffleString:	"s20",
			repeatString:	"s21",
			listTitle:		"s22",
			artMask:		"s23",
			isIpodDocked:	"d1",
			playbackState:	"d2",
			shuffleState:	"d3",
			repeatState:	"d4",
			menuList:		"l1",
			progress:		"a1",
			alphabar:		"a2",
			mainMenu:		"d9",
		}
	});

	/* Create our httpserver that will return artwork.
	var dataServer = httpServer("HTTP_SERVER", "HTTP_REQUEST");
	dataServer.onRequestReceived = function(request, command, path, headers) {
		CF.log("HTTP Request received: " + path);
		if (path == "/getartwork") {
			CF.log("artwork length: " + iPodDock.artworkData.data.length);

			var headers = {
				"Content-Type": "image/bmp"
			};

			var body = iPodDock.bitmapHeader55;
			CF.log("Bitmap header length: " + body.length);
			// Split the bytes into rows based on the rowSize returned from the dock
			var rows = iPodDock.artworkData.data.match(/[\s\S]{1,110}/g);
			// Reverse order, as image data is bottom up, need to render top down
			for (var i = rows.length - 1; i >= 0; i--) {
				body += rows[i] + "\x00\x00";
			}
			
			body += "\x00\x00";

			CF.log("bitmap length: " + body.length);

			dataServer.sendResponse(headers, body, true);

			//var headers;
			//dataServer.sendResponse(headers, "this is a test", false);
		}
	};
	dataServer.start();
	*/

	// Instantiate the cover art module, used to get dynamic artwork from a web service
	albumart = new CoverartFinder();

	// Create a new loading spinner controller for the loading image
	loading = new Spinner("s99", 1, true, "s98");
};