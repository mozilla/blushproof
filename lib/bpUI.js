/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const windows = require("windows").browserWindows;
const BROWSERURL = "chrome://browser/content/browser.xul"

function handleNavigation(aWindow, aURI) {
  aWindow.openDialog("chrome://browser/content/", null, "chrome,all,dialog=no,private", aURI);
}

function makeOrFindPrivateWindow(options) {
  let specialname = "blushproof-private-window";
  console.log("this would be the private window");
  let privates = [];
  for (let win of windows) {
    console.log('window name', win.name, "|", win.isPrivateBrowsing);
    if (win.isPrivateBrowsing) {
      privates.push(win);
    }
    //console.log(JSON.stringify(Object.keys(x),null,2));
    if (win.name == specialname) {
      return win;  // if we find the blushproof one.
    }
  }
  if (privates.length) {
    return privates[0];
  } // some private window, if any exist.
  // didn't find one, make it.  TODO, should be private!
  return windowUtils.open(BROWSERURL, {name:specialname,
      features : {
        "menubar"    : true,
        "titlebar"   : true,
        "scrollbars" : true,
        "status"     : true,
        "toolbar"    : true,
        "location"   : true,
        "private"    : true}
    });
}

function raiseConsent(scriptdata) {
  scriptdata = scriptdata || {};
  let consentpanel = Panel({
    width: 400,
    height: 400,
    contentURL: data.url('consent.html'),
    contentScriptOptions:  scriptdata,
    onHide: function() {
      let win = makeOrFindPrivateWindow();
      win.activate();
    }
  });
  return consentpanel;
}

exports.handleNavigation = handleNavigation;
