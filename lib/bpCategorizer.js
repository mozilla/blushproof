/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
let ss = require("simple-storage");

const blushlist = require("blushlist");
const searchterms = require("searchterms");
let bpUtil = require("bpUtil");


// initialize things to an empty state if we're starting from scratch
if (!ss.storage.blushlist || !ss.storage.blushlist.map ||
    !ss.storage.blushlist.version) {
  ss.storage.blushlist = {};
  ss.storage.blushlist.map = {};
  ss.storage.blushlist.version = "";
}

if (!ss.storage.searchterms || !ss.storage.searchterms.map ||
    !ss.storage.searchterms.version) {
  ss.storage.searchterms = {};
  ss.storage.searchterms.map = {};
  ss.storage.searchterms.version = "";
}

update(ss.storage.blushlist, blushlist);
update(ss.storage.searchterms, searchterms);

/** Updates the old map by removing old non-user entries and adding new ones.
 * Only does so if the version of the old storage object does not match the
 * version of the new storage object.
 *
 * @param oldstorage the old object with properties 'map' and 'version'
 * @param newstorage the new object with properties 'map' and 'version'
 */
function update(oldstorage, newstorage) {
  if (oldstorage.version != newstorage.version) {
    oldstorage.version = newstorage.version;

    // remove all old non-user entries
    for (let hash in oldstorage.map) {
      if (oldstorage.map[hash] != "user")
        delete oldstorage.map[hash];
    }

    for (let hash in newstorage.map)
      oldstorage.map[hash] = newstorage.map[hash];
  }
}

/** Returns the sha256 hash of the given string, truncated to 24 bytes (as
 * a hex string)
 *
 * @param aString the string to hash
 * @returns A hex string representing 24 bytes of the sha256 hash of aString
 */
function getHash(aString) {
  // Implementation informed by
  // developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsICryptoHash
  let cryptoHash = Cc["@mozilla.org/security/hash;1"]
                     .createInstance(Ci.nsICryptoHash);
  cryptoHash.init(Ci.nsICryptoHash.SHA256);
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                    .createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  let data = converter.convertToByteArray(aString);
  cryptoHash.update(data, data.length);
  let hash = cryptoHash.finish(false);
  function toHexString(charCode) {
    return ("0" + charCode.toString(16)).slice(-2);
  }
  let hashStr = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
  return hashStr.slice(0, 48);
}

/** Returns the category of the domain on the blushlist.
 *
 * @param domain The nsIURI.host to check.
 * @returns A possibly-null string containing the category of the domain.
 */
function getCategoryForBlushlist(domain) {
  let etld = bpUtil.getBaseDomainFromHost(domain);
  return ss.storage.blushlist.map[getHash(etld)];
}
exports.getCategoryForBlushlist = getCategoryForBlushlist;

function isQueryEmbarrassing(query) {
  return ss.storage.searchterms.map[getHash(query.toLowerCase())];
}
exports.isQueryEmbarrassing = isQueryEmbarrassing;
