/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const xpcom = require("xpcom");
let bpCategorizer = require("bpCategorizer");
let bpUI = require("bpUI");

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
      console.log("shouldLoad");
      if (aContentType == Ci.nsIContentPolicy.TYPE_DOCUMENT) {
        if (bpCategorizer.matchBlushlist(aContentLocation.spec)) {
          console.log("!!! aContext: " + aContext);
          let win = null;
          let node = null;
          if (aContext instanceof Ci.nsIDOMWindow) {
            win = aContext.QueryInterface(Ci.nsIDOMWindow);
            console.log("!!! win: " + win);
          }
          else if (aContext instanceof Ci.nsIDOMNode) {
            node = aContext.QueryInterface(Ci.nsIDOMNode);
            win = node.ownerDocument.defaultView;
            console.log("!!! node: " + node);
            console.log("!!! win: " + win);
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
