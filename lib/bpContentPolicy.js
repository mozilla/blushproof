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

/**
 * A map of string -> bool indicating that any host with a base domain
 * represented by the string should not be opened in a private window. This
 * persists across restarts.
 */
if (!ss.storage.whitelistedDomains) {
  ss.storage.whitelistedDomains = {};
}

/**
 * A map of string -> bool indicating that searches with the given query
 * string should not be opened in a private window. This persists across
 * restarts.
 */
if (!ss.storage.whitelistedQueries) {
  ss.storage.whitelistedQueries = {};
}

/**
 * Adds a domain to the list of domains to not be opened in a private window.
 * @param {string} aHost the host from which to get a domain to be whitelisted
 */
exports.whitelistHost = function(aHost) {
  let etld = bpUtil.getBaseDomainFromHost(aHost);
  ss.storage.whitelistedDomains[etld] = true;
}

/**
 * Adds a query to the list of queries to not be opened in a private window.
 * @param {string} aQuery the query to whitelist
 */
exports.whitelistQuery = function(aQuery) {
  ss.storage.whitelistedQueries[aQuery] = true;
}

/**
 * Returns true if the base domain of the given host has been whitelisted.
 * @param {string} aHost the host in question.
 */
function isHostWhitelisted(aHost) {
  let etld = bpUtil.getBaseDomainFromHost(aHost);
  return ss.storage.whitelistedDomains[etld];
}

/**
 * Returns true if the query has been whitelisted.
 * @param {string} aQuery the query in question.
 */
function isQueryWhitelisted(aQuery) {
  return ss.storage.whitelistedQueries[aQuery];
}

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

    // Ignore whitelisted queries and URLs
    let query = bpUtil.getSearchTermFromURI(aContentLocation);
    if (isHostWhitelisted(aContentLocation.host) || isQueryWhitelisted(query)) {
      return Ci.nsIContentPolicy.ACCEPT;
    }

    let category = bpCategorizer.getCategoryForBlushlist(aContentLocation.host);
    // Ignore non-blushy requests
    if (!category && !bpCategorizer.isQueryEmbarrassing(query)) {
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
      console.log("stopping load for non-private window");
      bpUI.handleNavigation(win, aContentLocation);
      return Ci.nsIContentPolicy.REJECT_TYPE;
    }
    console.log("in private window - not stopping load");
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
