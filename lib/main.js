"use strict";

// to see the list of these... `cfx docs`

let {data} = require('self');
//https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/tabs.html
let tabs = require('tabs');

// perhaps this should be a url hit?  i.e., json at 'naughtylist.mozilla.com'
let blacklist = [
	// rather than one-arg, could be list of lists with categories.
	"facebook",
	"xtube",
	"xxx",
	"okcupid",
];

// are we in the blacklist?
let in_blacklist = function(url){
	let allgood = true;
	blacklist.forEach(function(u){
		if (!allgood) return false;
		if (url.indexOf(u) != -1) {
			console.log("got match:", u);
			allgood = false;
		}
		return true;
	});
	console.log("allgood is", allgood)
	return !allgood;
};

let consentpanel =require("panel").Panel({
	width: 400,
	height: 400,
	contentURL: data.url('consent.html')
});


let snoopUrlbar = function(){
	let utils = require('sdk/window/utils');
	let active = utils.getMostRecentBrowserWindow()
	console.log("SNOOP:",utils.getXULWindow(active)) // .getElementById('urlbar'));
	console.log(JSON.stringify(Object.keys(utils.getXULWindow(active))),null,2);
	// ["QueryInterface","docShell","intrinsicallySized","primaryContentShell",
	// "getContentShellById","addChildWindow","removeChildWindow","center","showModal","zLevel","contextFlags","chromeFlags","assumeChromeFlagsAreFrozen","createNewWindow","XULBrowserWindow","lowestZ","loweredZ","normalZ","raisedZ","highestZ"]
	console.log(JSON.stringify(Object.keys(active.gBrowser)),null,2);
	let el = active.document.getElementById('urlbar');
	// these should all get unloaded, or check for existence.  deprecated windowTracker?
	// this is one way of loading things... doesn't catch links / tabs... can we catch urls event earlier?
	// must be an "on page url attempt to load" sort of event!
	el.addEventListener("keydown",
    function(evt){
    	if (evt.keyCode == 13) { // Enter key)
				let url = el.value;
        console.log('click on urlbar, for', url);
        if (in_blacklist(url)){
        	console.log('blacklisted');
        	consentpanel.show();
        	evt.preventDefault();
        	return false;
        } else {
        	return true; // carry on!
        }
    	} return true;
    },
    false)
};


var makeOrFindPrivateWindow = function (options){
	console.log("this would be the private window");
}


let main = exports.main = function(options){
	snoopUrlbar();
}
