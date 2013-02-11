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
 * Adds a domain to the list of domains to not be opened in a private window.
 * @param {string} aHost the host from which to get a domain to be whitelisted
 */
exports.whitelistHost = function(aHost) {
  let etld = bpUtil.getBaseDomainFromHost(aHost);
  ss.storage.whitelistedDomains[etld] = true;
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
    try {
      if (/^https?$/.test(aContentLocation.scheme) &&
          (aContentType == Ci.nsIContentPolicy.TYPE_DOCUMENT)) {
        let query = bpUtil.getSearchTermFromURI(aContentLocation);
        if ((bpCategorizer.getCategoryForBlushlist(aContentLocation.host) ||
             bpCategorizer.isQueryEmbarrassing(query)) &&
             !isHostWhitelisted(aContentLocation.host)) {
          let win = null;
          let node = null;
          if (aContext instanceof Ci.nsIDOMWindow) {
            win = aContext.QueryInterface(Ci.nsIDOMWindow);
          }
          else if (aContext instanceof Ci.nsIDOMNode) {
            node = aContext.QueryInterface(Ci.nsIDOMNode);
            win = node.ownerDocument.defaultView;
          }
          if (win && !isWindowPrivate(win)) {
            console.log("stopping load for non-private window");
            bpUI.handleNavigation(win, aContentLocation);
            return Ci.nsIContentPolicy.REJECT_TYPE;
          } else {
            console.log("in private window - not stopping load");
          }
        }
      }
    } catch (e) {
      console.log("error", e);
    }
    return Ci.nsIContentPolicy.ACCEPT;
  },

  // TODO: We should return false for non-HTTP urls
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
