/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

/** Usage and expansion

* `brew install hub` # if you want a night github aware git, and alias it
* download cfx:  git clone mozilla/addon-sdk
* alias cfx somewhere

  cfx docs
	cfx run # runs this
	# actually run with new style private windows
	cfx run -b /Applications/FirefoxAurora.app/Contents/MacOS/firefox
	cfx xpi # make an xpi

Useful tips:

* everything inline here will be run.  If there are panels, windowTrackers, etc,
  the will 'just work'.

* in Fx, open "chrome://browser/content/browser.xul", to get 'browser in a browser'.
  From there, use developer tools to explore

	'window' there is the same thing as:

	* windowTracker.onTrack(window)
	* windowUtils.activeXULw



TODO:

* plumb in the window specifics in the message
* event handler for the 'ask window', and permanent storage of answers in require('simple-storage')
  or elsewhere
* actually open a private window
  - append the tab
  - activate it all!
* is 'addressbar' the only place we want to catch?  Should *all urls* involving a blush be
  handled?

  For example:  facebook like buttons on pages... should they show? if you are anti-Fb
  For example:  what if a facebook page loads via link?

  To handle these use, nsiContentPolicy.
* UI for viewing, mod, editing blushlist
*/


// imports and constants
const {data} = require('self');
const {Panel} = require('panel');
//https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/tabs.html
let tabs = require('tabs');
const windows = require("windows").browserWindows;
let windowUtils = require('sdk/window/utils');
const {WindowTracker} = require("sdk/deprecated/window-utils");

const BROWSERURL = "chrome://browser/content/browser.xul"

/* blushlist subsytem */

// TODO:  perhaps this should be a url hit?  i.e., json at 'naughtylist.mozilla.com'
let blushlist = [
	// subsring, category
	["facebook", 'social'],
	["xtube",'porn'],
	["xxx",'porn'],
	["okcupid",'dating'],
	['poker','gambling']
];

// are we in the blushlist?
/** return first substring matching tuple from blushlist, or undefined
  *
  * @returns {list} matching tuple of [string,category], or undefined
  */
let match_blushlist = function(url){
	console.log('in match_blushlist');
	for (let ii = 0, L = blushlist.length; ii < L; ii++){
		let u = blushlist[ii];
		if (url.indexOf(u[0]) != -1) {
			console.log("got match:", u);
			return u
		} else {
			console.log("no match",u);
		}
	}
	return null;
};


/** UI subsection */

/** return a consent panel */
function raiseConsent(scriptdata){
	scriptdata = scriptdata || {};
	let consentpanel = Panel({
		width: 400,
		height: 400,
		contentURL: data.url('consent.html'),
		contentScriptOptions:  scriptdata,
		onHide:  function(){
			let win = makeOrFindPrivateWindow();
			win.activate();
		}
	});
	return consentpanel;
}

// ensure that our listeners are on every window that is opened
let addressbarTracker = new WindowTracker({
  onTrack: function(window) {
  	// it must be the chrome
    if ("chrome://browser/content/browser.xul" != window.location) return;
    let addressbar = window.document.getElementById('urlbar'); // or searchbar?
    if (! addressbar) {
    	console.log("no urlbar? that's weird!");
    	return
    };
    // track enter key on this...
    addressbar.addEventListener("keydown",
	    function(evt){
	    	if (evt.keyCode == 13) { // Enter key)
					let addressbarstring = addressbar.value;
	        console.log('click on urlbar, for', addressbarstring);
	        let m = match_blushlist(addressbarstring);
	        if (m){
	        	console.log('blushlisted!');
	        	raiseConsent({site:m[0],category:m[1]}).show();

	        	evt.preventDefault();
	        	// put events onto the consent window to handle events
	        	//let w = makeOrFindPrivateWindow();
	        	//w.openURL(url);
	        	return false;  // stop the event
	        } else {
	        	return true; // carry on!
	        }
	    	} return true;
	    },
	   false);
  }
});


/*
10:35 <@John-Galt> Yeah, if you don't have a browser window, you basically have to open one. window.open is magic.
10:35 <@John-Galt> I'd probably just grab a navigator:browser window and use its open method.
10:35 < Mook_as> I imagine code near http://mxr.mozilla.org/mozilla-central/source/toolkit/content/contentAreaUtils.js#1122 would be useful
10:35 < Mook_as> or just that whole function...
10:35 < gregglind> okay, those are ideas.  Thanks.
10:35 <@John-Galt> Except that contentAreaUtils needs to be loaded into a chrome window and not a Jetpack module...
*/

// TODO, this doesn't really work.
var makeOrFindPrivateWindow = function (options){
	let specialname = "blushproof-private-window";
	console.log("this would be the private window");
	let privates = [];
	for each (let win in windows){  // TODO, replace 'each' with another idiom
		console.log('window name',win.name,"|",win.isPrivateBrowsing);
		if (win.isPrivateBrowsing) { privates.push(win)}
		//console.log(JSON.stringify(Object.keys(x),null,2));
		if (win.name == specialname) {
			return win  // if we find the blushproof one.
		}
	}
	if (privates.length) {return privates[0]} // some private window, if any exist.
	// didn't find one, make it.  TODO, should be private!
	return windowUtils.open(BROWSERURL,{name:specialname,
			features:{
				"menubar":true,
				"titlebar":true,
				"scrollbars":true,
				"status":true,
				"toolbar":true,
				"location":true,
				"private":true}
		})
}

// TODO:  handle putting the focus on the last char, of a field, but doesn't work!
// http://stackoverflow.com/questions/4609405/set-focus-after-last-character-in-text-box
function focusEndOfField(inputField){
    if (inputField != null && inputField.value.length != 0){
        if (inputField.createTextRange){
            var FieldRange = inputField.createTextRange();
            FieldRange.moveStart('character',inputField.value.length);
            FieldRange.collapse();
            FieldRange.select();
        }else if (inputField.selectionStart || inputField.selectionStart == '0') {
            var elemLen = inputField.value.length;
            inputField.selectionStart = elemLen;
            inputField.selectionEnd = elemLen;
            inputField.focus();
        }
    }else{
        inputField.focus();
    }
} // note, doesn't work for the addressbar field


/*
let addressbarTracker = new WindowTracker({
  onTrack: function(window) {
    console.log("hintdemo",window.location);
    if ("chrome://browser/content/browser.xul" != window.location) return;
    let addressbar = window.document.getElementById('urlbar')
    if (! addressbar) {
    	console.log("no urlbar?");
    	return
    };
    addressbar.placeholder = "Search the web"; // should be l10n.
    // set the value... addressbar.value = "Search the web";
    // put the pointer there.
    // addressbar.focus()  // BUG, puts focus on whole field.
    // addressbar.

  }
});*/



// The main function is called on shutdown, startup, addon enable, disable.
// options.staticArgs, reason, and lots of other bits from harness-options.json
// are in here.
let main = function(options){
	console.log("started up!");
	raiseConsent().show();
	//makeOrFindPrivateWindow();
};



// main must be exported to be known as the entry point.
// I like to gather exports at the bottom.
exports.main = main;






/*
08:38 < erikvold> the WindowTracker is still the best thing to use right now I think
08:39 < erikvold> There is lots of stuff that I want to update for the toopbarbutton and menutitem modules
08:39 < erikvold> with private browsing, you'll have to check if the window is private if you are handling sensitive data from the window
08:40 < erikvold> you'll have to opt-in to see private windows tho, otherwise they will be ignored/skipped by things like WindowTracker
08:40 < erikvold> I'll write a blog post soon
08:41 < erikvold> as for using 3rd party packages, I just clone them someplace and soft link to them from the packages folder of the sdk
08:42 < gregglind> no fancy volo or anything re: packages?
08:45 < gregglind> erikvold, suggestion on the calls in windowUtils (new style!) to a.) get a private window, if there isn't one, and b.) get the 'same one', and c.)
                   add a tab onto some private window
08:48 < erikvold> c is the same as usual once you do a
08:48 < erikvold> b I don't understand
08:49 < erikvold> for a you'd use the windowIterator and check that it is private (new way!) require('private-browsing').isPrivate(window)
08:50 < erikvold> oops
08:50 < erikvold> get one if there is one, well that's how you check that there isn't one
08:51 < erikvold> then you'd use require('windows').browserWindows.open({url: "about:", private: true}) or the openDialog in window-utils will have the same flag
08:56 -!- wbamberg [wbamberg@moz-34EEABEF.bchsia.telus.net] has joined #jetpack
08:57 -!- mixedpuppy [mixedpuppy@moz-7B3CFB22.vc.shawcable.net] has joined #jetpack
08:57 < gregglind> thanks, I need to look at the flags

window.openDialog("chrome://browser/content/", "name", "chrome,private,...");
window.openDialog("facebook.com", "name", "chrome,private,all");

nsiContentPolicy-ish api
http://stackoverflow.com/questions/10788489/an-example-of-nsicontentpolicy-for-firefox-addon
http://lduros.net/posts/blocking-images-and-other-content-mozila-add-sdk-and-nsicontentpolicy/
*/