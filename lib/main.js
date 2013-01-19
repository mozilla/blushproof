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
	'newtab'
];

// are we in the blacklist?
let in_blacklist = function(url){
	let allgood = true;
	blacklist.forEach(function(u){
		if (!allgood) return false;
		if (url.indexOf(u) != -1) allgood = false;
		return true;
	});
	return allgood;
};


// we should catch this earlier than tab-ready, but tab-open is too early.
// tab-ready is after the url has loader, ERGH!
// not quite sure how to catch urls *really early* maybe urlbar keyup?
tabs.on("open",function(tab){
	let url = tab.url;
	if (in_blacklist(url)) {
		var panel = require("panel").Panel({
			width: 180,
			height: 180,
			contentURL: data.url('consent.html')
		});
		panel.show();
		return false
	}
	return true;

});

