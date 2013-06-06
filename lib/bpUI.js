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
const { storage } = require("simple-storage");
const tabs = require("sdk/tabs");

let bpContentPolicy = require("bpContentPolicy");
let bpCategorizer = require("bpCategorizer");
let bpUtil = require("bpUtil");
let { recordEvent, monitor, kEvents } = require("monitor");
let prefs = require("simple-prefs").prefs;

const { Cc, Ci, Cu } = require("chrome");
// The second param avoids polluting the scope
const { ForgetAboutSite } = Cu.import("resource://gre/modules/ForgetAboutSite.jsm", {});

let installPanel = panel.Panel({
  contentURL: data.url("install.html"),
  onMessage: function(aMessage) {
    if (aMessage == "disable") {
      prefs.enable_reporting = false;
      monitor.stop();
      this.hide();
    } else if (aMessage == "showdoc") {
      tabs.open("https://github.com/mozilla/blushproof/wiki/Design-doc#data-that-blushproof-collects");
    } else {
      this.hide();
    }
  }
});

if (!storage.firstRun) {
  storage.firstRun = true;
  installPanel.show();
}

let blushPanel = panel.Panel({
  contentURL: data.url("blushthis.html"),
  onMessage: function(aMessage) {
    let host = utils.getMostRecentBrowserWindow().gBrowser.selectedBrowser
                 .contentWindow.location.host;
    // Unfortunately, [current browser].contentWindow.location is not an
    // nsIURI, so .host does not do what we expect; it can include the port
    // number. So, we just have to remove that.
    let domain = normalizeHost(host);
    if (aMessage == "blush") {
      bpCategorizer.addToBlushlist(domain);
      recordEvent(kEvents.ADD_BLUSHLIST);
      this.hide();
    } else if (aMessage == "forget") {
      ForgetAboutSite.removeDataFromDomain(domain);
      recordEvent(kEvents.FORGET_SITE);
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
  contentURL: data.url("blushbutton.html"),
  width: 100,
  panel: blushPanel,
});

exports.blushButton = blushButton;

// This regular expression captures anything that's not ':' until it
// encounters a ':' followed by 1 or more numbers. It's meant to match
// a domain name followed by ':<port number>'
let gHostPortRegExp = new RegExp();
gHostPortRegExp.compile(/([^:]*):[0-9]+/);

/**
 * Given a string representing a host name that may include a port number,
 * return just the domain name.
 * @param aHost a string representing a host name
 * @return a string representing the domain name
 */
function normalizeHost(aHost) {
  let match = gHostPortRegExp.exec(aHost);
  if (match) {
    return match[1];
  } else {
    return aHost;
  }
}

/**
 * @param {nsIDOMWindow} aWindow The window being navigated
 * @param {nsIURI} aURI The URI being navigated to
 * @param {nsIDOMNode} aNode The node of the browser being navigated
 */
function handleNavigation(aWindow, aURI, aNode) {
  // try to select the tab that's being navigated
  if (aNode) {
    let tabbrowser = aWindow.gBrowser;
    let index = tabbrowser.getBrowserIndexForDocument(aNode.ownerDocument);
    tabbrowser.selectTabAtIndex(index);
  }
  let panel = raiseConsent(aWindow, aURI);
  panel.show();
}
exports.handleNavigation = handleNavigation;

/**
 * If the urlbar currently contains an embarrassing url, reset it to the url of
 * the current document (which is not embarassing). If the search box
 * contains an embarrassing search term, clear it.
 * @param {nsIDOMWindow} aWindow The window to sanitize
 * @param {string} aQueryCategory The category of the search query, if any
 */
function clearEmbarrassingBrowserState(aWindow, aQueryCategory) {
  aWindow.gURLBar.value = aWindow.gBrowser.selectedBrowser.contentWindow.location.toString();
  if (aQueryCategory) {
    aWindow.BrowserSearch.searchBar.textbox.reset();
  }
}

/**
 * @param {nsIDOMWindow} aWindow The window being navigated
 * @param {nsIURI} aURI The URI being navigated to
 */
function raiseConsent(aWindow, aURI) {
  let consentpanel = panel.Panel({
    width: 600,
    height: 156,
    contentURL: data.url('consent.html'),
    onMessage: function(aMessage) {
      let query = bpUtil.getSearchTermFromURI(aURI);
      if (aMessage == "openInPrivate") {
        recordEvent(kEvents.OPEN_PRIVATE);
        clearEmbarrassingBrowserState(aWindow, query);
        aWindow.openDialog(BROWSERURL, null, "chrome,all,dialog=no,private",
                           aURI.spec);
      } else if (aMessage == "continue") {
        recordEvent(kEvents.OPEN_NORMAL);
        this.hide();
        if (bpCategorizer.getCategoryForQuery(query)) {
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
