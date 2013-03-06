/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
let ss = require("simple-storage");

const blushlist = require("blushlist");
const searchterms = require("searchterms");
let bpUtil = require("bpUtil");

if (!ss.storage.blushlist) {
  ss.storage.blushlist = {};
  for (let hash in blushlist)
    ss.storage.blushlist[hash] = blushlist[hash];
}

if (!ss.storage.searchterms) {
  ss.storage.searchterms = {};
  for (let hash in searchterms)
    ss.storage.searchterms[hash] = searchterms[hash];
}

/** Returns the sha256 hash of the given string, truncated to 24 bytes (as
 * a hex string)
 *
 * @param aString the string to hash
 * @returns A hex string representing 24 bytes of the sha256 hash of aString
 */
function getHash(aString) {
  let cryptoHash = Cc["@mozilla.org/security/hash;1"]
                     .createInstance(Ci.nsICryptoHash);
  cryptoHash.init(Ci.nsICryptoHash.SHA256);
  let stringStream = Cc["@mozilla.org/io/string-input-stream;1"]
                       .createInstance(Ci.nsIStringInputStream);
  stringStream.data = aString;
  cryptoHash.updateFromStream(stringStream, -1);
  let hash = cryptoHash.finish(false);
  let hashStr = "";
  for (let i = 0; i < 24; i++) {
    let hexChr = (hash.charCodeAt(i)).toString(16);
    hashStr += (hexChr.length == 2 ? hexChr : "0" + hexChr);
  }
  return hashStr;
}

/** Returns the category of the domain on the blushlist.
 *
 * @param domain The nsIURI.host to check.
 * @returns A possibly-null string containing the category of the domain.
 */
function getCategoryForBlushlist(domain) {
  let etld = bpUtil.getBaseDomainFromHost(domain);
  return ss.storage.blushlist[getHash(etld)];
}
exports.getCategoryForBlushlist = getCategoryForBlushlist;

function isQueryEmbarrassing(query) {
  return ss.storage.searchterms[getHash(query.toLowerCase())];
}
exports.isQueryEmbarrassing = isQueryEmbarrassing;
