/*  Spinner module for CommandFusion
===============================================================================

AUTHOR:		Jarrod Bell, CommandFusion
CONTACT:	support@commandfusion.com
URL:		https://github.com/CommandFusion/
VERSION:	v1.0.0
LAST MOD:	Tuesday, 27 September 2011

=========================================================================
HELP:

Create a new spinner for any GUI object like so:

var mySpinner = new Spinner("d10", 1, true);

Then start it like so:
mySpinner.start();

And to stop it:
mySpinner.stop();

Simple as that.

=========================================================================
*/

// ======================================================================
// Global Object
// ======================================================================

var Spinner = function (join, duration, hideWhenStopped, bgJoin) {
	var self = {
		join:		"",
		bgJoin:		"",
		duration:	0,
		hideWhenStopped:	false,
		rot:		0,
		spinning:	false
	};

	self.start = function () {
		// Prevent multiple recursive loops from starting
		if (self.spinning) {
			return;
		}
		self.spinning = true;
		self.rot = 0;
		CF.setProperties({join: self.join, zrotation: 0, opacity: 1}, 0, 0, CF.AnimationCurveLinear, self.spin);
		if (self.bgJoin !== null) {
			CF.setProperties({join: self.bgJoin, opacity: 1});
		}
	};

	self.spin = function () {
		self.rot += 179;
		if (self.spinning) {
			CF.setProperties({join: self.join, zrotation: self.rot}, 0, self.duration / 2.0, CF.AnimationCurveLinear, self.spin);
		}
	};

	self.stop = function () {
		self.spinning = false;
		if (self.hideWhenStopped) {
			CF.setProperties({join: self.join, opacity: 0});
			if (self.bgJoin !== null) {
				CF.setProperties({join: self.bgJoin, opacity: 0});
			}
		}
	};

	self.join = join;
	self.duration = duration || 0.5;
	self.hideWhenStopped = hideWhenStopped || false;
	self.bgJoin = bgJoin || null;

	return self;
}

// Push a module, even though we don't have a setup function to call,
// this remains good practice.
CF.modules.push({
	name: "Spinner",
	object: Spinner
});
