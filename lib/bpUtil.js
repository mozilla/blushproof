/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");

let eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                    .getService(Ci.nsIEffectiveTLDService);

/**
 * Given a host represented by a string, returns the (eTLD+1) base domain
 * for that host. Returns the host itself if there is some sort of error
 * with the eTLD service.
 * @param {string} aHost the host in question
 * @return {string} the base domain for that host
 */
exports.getBaseDomainFromHost = function(aHost) {
  let etld = aHost;
  try {
    etld = eTLDService.getBaseDomainFromHost(aHost);
  } catch (e) {
    console.log("eTLDService error: " + e);
  }
  return etld;
}
