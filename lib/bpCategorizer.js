/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var {Cc, Ci} = require("chrome");
var eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"].
                  getService(Ci.nsIEffectiveTLDService);

const blushlist = require("./blushlist");

/** Returns the category of the domain on the blushlist.
 *
 * @param domain The nsIURI.host to check.
 * @returns A possibly-null string containing the category of the domain.
 */
function getCategoryForBlushlist(domain) {
  let etld = domain;
  try {
    etld = eTLDService.getBaseDomainFromHost(domain);
  } catch(e) {
    console.log("eTldService error: " + e);
  }
  return blushlist[etld];
}

exports.getCategoryForBlushlist = getCategoryForBlushlist;
