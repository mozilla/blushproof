"use strict";

// perhaps this should be a url hit?  i.e., json at 'naughtylist.mozilla.com'
let blacklist = [
  // rather than one-arg, could be list of lists with categories.
	"facebook",
	"xtube",
	"xxx",
	"okcupid"
];

// are we in the blacklist?
let in_blacklist = function(url){
	let allgood = true;
	blacklist.forEach(function(u){
		if (!allgood) return false;
		if (url.indexOf(u) != -1) allgood = false;
		return true;
	});
};



//https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/tabs.html
let tabs = require('tabs');

// we should catch this earlier than tab-ready, but tab-open is too early.
// tab-ready is after the url has loader, ERGH!
// not quite sure how to catch urls *really early* maybe urlbar keyup?
tabs.on("ready",function(tab){
	let url = tab.url;
	if (in_blacklist(url)) {
		console.log("Really, you want to open?", url);
		return false
	}
	return true;

});

