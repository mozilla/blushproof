/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const xpcom = require("xpcom");
let bpCategorizer = require("bpCategorizer");
let bpUI = require("bpUI");
let whitelistedURIs = new Map();

exports.whitelistURI = function(aURI) {
  whitelistedURIs.set(aURI, true);
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
      if (aContentType == Ci.nsIContentPolicy.TYPE_DOCUMENT) {
<<<<<<< HEAD
        if (bpCategorizer.matchBlushlist(aContentLocation.spec)) {
          console.log("!!! aContext: " + aContext);
=======
        if (bpCategorizer.matchBlushlist(aContentLocation.spec) &&
            !whitelistedURIs.get(aContentLocation.spec)) {
>>>>>>> issue 12: hook consent panel into bpUI.handleNavigation
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
            bpUI.handleNavigation(win, aContentLocation.spec);
            return Ci.nsIContentPolicy.REJECT_TYPE;
          } else {
            console.log("in private window - not stopping load");
          }
        }
      }
    }
    catch (e) {
      console.log("error: " + e);
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
