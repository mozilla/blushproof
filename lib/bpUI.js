/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const windows = require("windows").browserWindows;
const BROWSERURL = "chrome://browser/content/browser.xul"

function handleNavigation(aWindow, aURI) {
  aWindow.openDialog("chrome://browser/content/", null,
                     "chrome,all,dialog=no,private", aURI);
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
