/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const xpcom = require("xpcom");
let ss = require("simple-storage");
let bpCategorizer = require("bpCategorizer");
let bpUI = require("bpUI");
let bpUtil = require("bpUtil");
let { recordEvent, monitor, kEvents } = require("monitor");

/**
 * Returns true if aWindow is in private browsing mode.
 * @param {nsIDOMWindow} aWindow The window to query.
 */
function isWindowPrivate(aWindow) {
  return aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIWebNavigation)
                .QueryInterface(Ci.nsILoadContext)
                .usePrivateBrowsing;
}

/**
 * The goal of the content policy is to intercept loading URLs that are
 * potentially embarrassing. If REJECT_TYPE is returned, then the url loader
 * should prompt the user to open a new window in private browsing mode before
 * loading the URL.
 */
exports.bpContentPolicy = Class({
  extends: xpcom.Unknown,
  interfaces: ["nsIContentPolicy"],

  shouldLoad: function(aContentType, aContentLocation, aRequestOrigin,
                       aContext, aMimeType, aExtra) {
    // Ignore non http(s) requests
    if (!/^https?$/.test(aContentLocation.scheme) ||
        aContentType != Ci.nsIContentPolicy.TYPE_DOCUMENT) {
      return Ci.nsIContentPolicy.ACCEPT;
    }

    // Ignore whitelisted queries and URLs.
    if (bpCategorizer.isHostWhitelisted(aContentLocation.host)) {
      recordEvent(kEvents.WHITELISTED_SITE);
      return Ci.nsIContentPolicy.ACCEPT;
    }

    let query = bpUtil.getSearchTermFromURI(aContentLocation);
    if (bpCategorizer.isQueryWhitelisted(query)) {
      recordEvent(kEvents.WHITELISTED_QUERY);
      return Ci.nsIContentPolicy.ACCEPT;
    }

    // Check against the blushlists.
    if (bpCategorizer.getCategoryForHost(aContentLocation.host)) {
      recordEvent(kEvents.BLUSHY_SITE);
    } else if (bpCategorizer.getCategoryForQuery(query)) {
      recordEvent(kEvents.BLUSHY_QUERY);
    } else {
      // Ignore non-blushy requests
      return Ci.nsIContentPolicy.ACCEPT;
    }

    // We have a blushy request, so see if we're in a private window.
    let win = null;
    if (aContext instanceof Ci.nsIDOMWindow) {
      win = aContext.QueryInterface(Ci.nsIDOMWindow);
    } else if (aContext instanceof Ci.nsIDOMNode) {
      let node = aContext.QueryInterface(Ci.nsIDOMNode);
      win = node.ownerDocument.defaultView;
    }

    // I couldn't get the previous to break, so throw on error and see if that
    // turns up anything. If not, just delete this stanza.
    if (!win) {
      throw "Couldn't get a window";
    }

    // Reject and prompt if we're not in a private window.
    if (!isWindowPrivate(win)) {
      bpUI.handleNavigation(win, aContentLocation);
      return Ci.nsIContentPolicy.REJECT_TYPE;
    }
    return Ci.nsIContentPolicy.ACCEPT;
  },

  shouldProcess: function(aContentType, aContentLocation, aRequestOrigin,
                          aContext, aMimeType, aExtra) {
    return Ci.nsIContentPolicy.ACCEPT;
  }
});

exports.bpContentPolicyFactory = xpcom.Factory({
  Component: exports.bpContentPolicy,
  contract: "@blushproof/BlushproofContentPolicy",
  description: "Blushproof Content Policy"
});
