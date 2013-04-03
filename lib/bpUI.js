/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const windows = require("windows").browserWindows;
const utils = require("window/utils");
const panel = require("panel");
const data = require("self").data;
const widget = require("sdk/widget");
const BROWSERURL = "chrome://browser/content/browser.xul"

let bpContentPolicy = require("bpContentPolicy");
let bpCategorizer = require("bpCategorizer");
let bpUtil = require("bpUtil");
const { Cc, Ci, Cu } = require("chrome");
// The second param avoids polluting the scope
const { ForgetAboutSite } = Cu.import("resource://gre/modules/ForgetAboutSite.jsm", {});

let blushPanel = panel.Panel({
  contentURL: data.url("blushthis.html"),
  onMessage: function(aMessage) {
    console.log("received message", aMessage);
    if (aMessage == "blush") {
      blushThis();
      this.hide();
    } else if (aMessage == "forget") {
      forgetThis();
    } else {
      this.hide();
    }
  },
  onShow: function() {
    let win = utils.getMostRecentBrowserWindow();
    win.dispatchEvent(new win.CustomEvent("BlushPanelShown", { detail: this }));
  },
  onHide: function() {
    let win = utils.getMostRecentBrowserWindow();
    win.dispatchEvent(new win.CustomEvent("BlushPanelHidden",
                                          { detail: this }));
  }
});

let blushButton = widget.Widget({
  id: "blush-button",
  label: "Blush Button",
  content: "Blush this!",
  width: 100,
  panel: blushPanel,
});

exports.blushButton = blushButton;

/**
 * Given a string representing a host name that may include a port number,
 * return just the domain name.
 * @param aHost a string representing a host name
 * @return a string representing the domain name
 */
function normalizeHost(aHost) {
  let regexp = /([^:]*):[0-9]+/;
  let match = regexp.exec(aHost);
  if (match) {
    return match[1];
  } else {
    return aHost;
  }
}

/**
 * Add the current URL to the blushlist.
 */
function blushThis() {
  let host = utils.getMostRecentBrowserWindow().gBrowser.selectedBrowser
    .contentWindow.location.host;
  // Unfortunately, [current browser].contentWindow.location is not an nsIURI,
  // so .host does not do what we expect; it can include the port number. So,
  // we just have to remove that.
  bpCategorizer.addToBlushlist(normalizeHost(host));
}

/**
 Forget about the current URL.
*/
function forgetThis() {
  let host = utils.getMostRecentBrowserWindow().gBrowser.selectedBrowser
    .contentWindow.location.host;
  // Unfortunately, [current browser].contentWindow.location is not an nsIURI,
  // so .host does not do what we expect; it can include the port number. So,
  // we just have to remove that.
  ForgetAboutSite.removeDataFromDomain(normalizeHost(host));
  // What about all the related domains?
}

/**
 * @param {nsIDOMWindow} aWindow The window being navigated
 * @param {nsIURI} aURI The URI being navigated to
 */
function handleNavigation(aWindow, aURI) {
  let panel = raiseConsent(aWindow, aURI);
  panel.show();
}
exports.handleNavigation = handleNavigation;

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
          bpCategorizer.whitelistQuery(query);
        } else {
          bpCategorizer.whitelistHost(aURI.host);
        }
        aWindow.gBrowser.selectedBrowser.contentWindow.location = aURI.spec;
      }
    },
    onShow: function() {
      aWindow.dispatchEvent(new aWindow.CustomEvent("ConsentPanelShown",
                                                    { detail: this }));
    },
    onHide: function() {
      aWindow.dispatchEvent(new aWindow.CustomEvent("ConsentPanelHidden",
                                                    { detail: this }));
    }
  });
  return consentpanel;
}
