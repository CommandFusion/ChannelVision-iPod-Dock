# ChannelVision A0316 iPod Dock Module
This JavaScript module allows you to control a ChannelVision A0316 iPod Dock via RS232 using an Ethernet to RS232 adapter.  
[A0316 Dock at ChannelVision.com](http://www.channelvision.com/index.php/iBus™-for-iPod®/Audio-Video-Meta-Data-iPod-iPhone-dock-A0316/flypage.tpl.html)

### Cover Art
Due to the control interface being RS232, cover art data is not taken from the iPod itself.  
The dock supports cover art requests, but the data is too large and floods the RS232 interface resulting in slow performance.  
The dock cover art is also in a low quality RGB565 format, definitely not pretty to look at.  
So for all these reasons, the cover art is instead grabbed from a cover art online search tool at albumart.org.  
There is a separate JavaScript file provided (coverart.js) to handle this.  
However you can see commented out code in the channelvisiondock.js file which relates to processing the cover art pixel data from the dock directly.

### Loading Animation
The interface uses a rotating loading animation (often called a spinner).  
This animation is controlled via the included spinner.js

### Caching List Data
Instead of requesting the artist list fresh each time, the artist data is cached until an iPod is removed and docked again.  
List of Genres and Playlists also uses this caching method, resulting in almost instant list refreshing.  
The scroll position of the artist list is also restored when navigating back to the artist list.