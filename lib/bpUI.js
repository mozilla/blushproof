/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const windows = require("windows").browserWindows;
const panel = require("panel");
const data = require("self").data;
const BROWSERURL = "chrome://browser/content/browser.xul"
let bpContentPolicy = require("bpContentPolicy");
let bpCategorizer = require("bpCategorizer");
let bpUtil = require("bpUtil");

/**
 * @param {nsIDOMWindow} aWindow The window being navigated
 * @param {nsIURI} aURI The URI being navigated to
 */
function handleNavigation(aWindow, aURI) {
  let panel = raiseConsent(aWindow, aURI);
  panel.show();
}

/**
 * @param {nsIDOMWindow} aWindow The window being navigated
 * @param {nsIURI} aURI The URI being navigated to
 */
function raiseConsent(aWindow, aURI) {
  let consentpanel = panel.Panel({
    width: 600,
    height: 140,
    contentURL: data.url('consent.html'),
    onMessage: function(aMessage) {
      if (aMessage == "openInPrivate") {
        console.log("Opening", aURI.spec, "in private window");
        aWindow.openDialog(BROWSERURL, null, "chrome,all,dialog=no,private",
                           aURI.spec);
      } else if (aMessage == "continue") {
        this.hide();
        let query = bpUtil.getSearchTermFromURI(aURI);
        if (bpCategorizer.isQueryEmbarrassing(query)) {
          bpContentPolicy.whitelistQuery(query);
        } else {
          bpContentPolicy.whitelistHost(aURI.host);
        }
        aWindow.gBrowser.selectedBrowser.contentWindow.location = aURI.spec;
      }
    }
  });
  return consentpanel;
}

exports.handleNavigation = handleNavigation;
