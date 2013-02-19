/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const blushlist = require("blushlist");
const searchterms = require("searchterms");
let bpUtil = require("bpUtil");

/** Returns the category of the domain on the blushlist.
 *
 * @param domain The nsIURI.host to check.
 * @returns A possibly-null string containing the category of the domain.
 */
function getCategoryForBlushlist(domain) {
  let etld = bpUtil.getBaseDomainFromHost(domain);
  return blushlist[etld];
}
exports.getCategoryForBlushlist = getCategoryForBlushlist;

function isQueryEmbarrassing(query) {
  return searchterms[query.toLowerCase()];
}
exports.isQueryEmbarrassing = isQueryEmbarrassing;
