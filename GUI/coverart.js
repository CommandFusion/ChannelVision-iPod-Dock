/*  Coverart Finder module for CommandFusion
===============================================================================

AUTHOR:		Jarrod Bell, CommandFusion
CONTACT:	support@commandfusion.com
URL:		https://github.com/CommandFusion/
VERSION:	v0.0.1
LAST MOD:	Friday, 23 September 2011

=========================================================================
HELP:

TODO

=========================================================================
*/

// ======================================================================
// Global Objects
// ======================================================================

var CoverartFinder = function () {
	
	var self = {
		baseURL: "http://www.albumart.org/index.php?itempage=1&newsearch=1&searchindex=",
		modes: {
			music:	"Music",
			movies: "DVD"
		},
		searchResultRegex:	/<div id="main_left">[\s\S]*?<img src="((?!http:\/\/www.albumart.org).*?)"[\s\S]*?<img src="((?!http:\/\/www.albumart.org).*?)"/i,
	};
	
	self.albumSearch = function (albumName, artistName, callback) {
		//CF.log("REQUEST: " + self.baseURL + self.modes.music + "&srchkey=" + encodeURIComponent(artistName + " - " + albumName));
		CF.request(self.baseURL + self.modes.music + "&srchkey=" + encodeURIComponent(artistName + " - " + albumName), function (status, headers, body) {
			var imageURLs = body.match(self.searchResultRegex);
			if (imageURLs != null) {
				// If we get more than one response, validate the first URL exists, otherwise use second (limit 404 image URLs which can happen from time to time)
				if (imageURLs.length > 2) {
					CF.request(imageURLs[1], function (status) {
						if (status != 200) {
							// Try the second search result as a last resort
							callback(imageURLs[2]);
						} else {
							callback(imageURLs[1]);
						}
					});
				} else {
					// Only one item returned, so use it without bothering validating.
					callback(imageURLs[1]);
				}
			}
		});
	};

	self.movieSearch = function (movieTitle) {
		CF.request(self.baseURL + self.modes.movies + "&srchkey=" + encodeURIComponent(movieTitle), function (status, headers, body) {
			CF.log(body);
		});
	};

	return self;
};

var Rocker = function (join, time, angle, maskJoin) {

	var self = {
		artJoin:	join,
		maskJoin:	maskJoin,
		rockTime:	time,
		rocking:	true
	};

	self.rockForward = function () {
		if (self.rocking) {
			CF.setProperties({join: self.maskJoin, zrotation: 0}, 0, 0, CF.AnimationCurveLinear, function() {
				CF.setProperties([{join: self.maskJoin, yrotation: -angle, opacity: 1.0}, {join: self.artJoin, yrotation: -angle}], 0, self.rockTime / 2, CF.AnimationCurveEaseOut, self.rockTo0);
			});
		}
	};

	self.rockTo0 = function () {
		if (self.rocking) {
			CF.setProperties([{join: self.maskJoin, yrotation: 0, opacity: 0}, {join: self.artJoin, yrotation: 0}], 0, self.rockTime / 2, CF.AnimationCurveEaseIn, self.rockBackward);
		}
	};

	self.rockBackward = function () {
		if (self.rocking) {
			CF.setProperties({join: self.maskJoin, zrotation: 180}, 0, 0, CF.AnimationCurveLinear, function() {
				CF.setProperties([{join: self.maskJoin, yrotation: -angle, opacity: 1.0}, {join: self.artJoin, yrotation: angle}], 0, self.rockTime / 2, CF.AnimationCurveEaseOut, self.rockFromBack);
			});
		}
	};

	self.rockFromBack = function () {
		if (self.rocking) {
			CF.setProperties([{join: self.maskJoin, yrotation: 0, opacity: 0}, {join: self.artJoin, yrotation: 0}], 0, self.rockTime / 2, CF.AnimationCurveEaseIn, self.rockForward);
		}
	};

	self.stop = function () {
		self.rocking = false;
		CF.setProperties({join: self.artJoin, yrotation: 0}, 0, self.rockTime / 2);
		CF.setProperties({join: self.maskJoin, yrotation: 0, opacity: 0});
	};

	self.rockForward();
	return self;
};

// Push a module, even though we don't have a setup function to call,
// this remains good practice.
CF.modules.push({
	name: "Coverart Finder",
	object: CoverartFinder
});

CF.modules.push({
	name: "Coverart Rocker",
	object: Rocker
});
