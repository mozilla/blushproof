/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
let querystring = require("querystring");

let eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                    .getService(Ci.nsIEffectiveTLDService);

/**
 * Given a host represented by a string, returns the (eTLD+1) base domain
 * for that host. Returns the host itself if there is some sort of error
 * with the eTLD service.
 * @param {string} aHost the host in question
 * @return {string} the base domain for that host
 */
function getBaseDomainFromHost(aHost) {
  let etld = aHost;
  try {
    etld = eTLDService.getBaseDomainFromHost(aHost);
  } catch (e) {
    console.log("eTLDService error getting tld from", aHost);
  }
  return etld;
}
exports.getBaseDomainFromHost = getBaseDomainFromHost;

/**
 * Given an nsURI, return the public suffix associated with the host.
 * @param {nsURI} aURI The URI in question.
 * @return {string} The public suffix associated with that URI, or nsIURI.host
 * if none can be found.
 */
function getPublicSuffix(aURI) {
  let suffix = aURI.host;
  try {
    suffix = eTLDService.getPublicSuffix(aURI);
  } catch (e) {
    console.log("eTLDService error: " + e);
  }
  return suffix;
}

/**
 * A map of search providers to { path, query parameters } used by the
 * provider. This (incomplete) map is taken from
 * mozilla-central/browser/locales/en-US/searchplugins/
 */
let searchMap = {
  "amazon" :
    { "path" : "/exec/obidos/external-search?", "query" : "field-keywords"},
  "bing" : { "path" : "/search?", "query" : "q" },
  "google" : { "path" : "/search?", "query" : "q" },
  "yahoo" : { "path" : "/search?", "query" : "p" },
};

/**
 * Given an nsIURI, returns a possibly-empty search term from that URI.
 * @param {nsIURI}  The URI in question.
 * @return {string} The search term, if any, associated with the URI.
 */
function getSearchTermFromURI(aURI) {
  let host = getBaseDomainFromHost(aURI.host);
  let publicSuffix = getPublicSuffix(aURI);
  let searchProvider = host;
  if (host.indexOf(publicSuffix) == -1) {
    return"";
  }
  // Just get the "google" part of "google.com"
  searchProvider = host.substr(0, host.length - publicSuffix.length - 1);
  if (!searchMap[searchProvider]) {
    return "";
  }
  let path = aURI.path;
  if (path.indexOf(searchMap[searchProvider].path) != 0) {
    return "";
  }
  // Strip off the path so we can parse just the query params. querystring
  // isn't very sophisticated, but this works for now.
  let q = path.substr(searchMap[searchProvider].path.length);
  console.log("query string", q);
  q = querystring.parse(q);
  if (!q) {
    console.log("Couldn't parse", path);
    return "";
  }
  console.log("query:", JSON.stringify(q));
  return decodeURI(q[searchMap[searchProvider].query]).replace("+", " ");
}
exports.getSearchTermFromURI = getSearchTermFromURI;

/**
 * Takes an array of four bytes and returns a 32-bit integer.
 */
function array2int(aArray) {
  let val = (aArray.charCodeAt(0) << 24) + (aArray.charCodeAt(1) << 16) + (aArray.charCodeAt(2) << 8) + aArray.charCodeAt(3);
  val &= ~(1 << 31); // don't want any negative values...
  return val;
}

function pokeBit(aArray, aBit) {
  let cell = aBit / 8;
  let offset = aBit % 8;
  let val = aArray[cell];
  val |= (1 << offset);
  aArray[cell] = val;
}

let gCryptoHash = Cc["@mozilla.org/security/hash;1"]
                    .createInstance(Ci.nsICryptoHash);

function addToBloomFilter(aFilter, aString) {
  gCryptoHash.init(Ci.nsICryptoHash.SHA256);
  let stringStream = Cc["@mozilla.org/io/string-input-stream;1"]
                       .createInstance(Ci.nsIStringInputStream);
  stringStream.data = aString;
  gCryptoHash.updateFromStream(stringStream, -1);
  let hash = gCryptoHash.finish(false);
  let h1 = array2int(hash.slice(0, 4)) % (aFilter.byteLength * 8);
  let h2 = array2int(hash.slice(4, 8)) % (aFilter.byteLength * 8);
  let h3 = array2int(hash.slice(8, 12)) % (aFilter.byteLength * 8);
  let h4 = array2int(hash.slice(12, 16)) % (aFilter.byteLength * 8);
  let h5 = array2int(hash.slice(16, 20)) % (aFilter.byteLength * 8);
  let h6 = array2int(hash.slice(20, 24)) % (aFilter.byteLength * 8);
  let h7 = array2int(hash.slice(24, 28)) % (aFilter.byteLength * 8);
  let h8 = array2int(hash.slice(28, 32)) % (aFilter.byteLength * 8);
  pokeBit(aFilter, h1);
  pokeBit(aFilter, h2);
  pokeBit(aFilter, h3);
  pokeBit(aFilter, h4);
  pokeBit(aFilter, h5);
  pokeBit(aFilter, h6);
  pokeBit(aFilter, h7);
  pokeBit(aFilter, h8);
}

function probeBit(aArray, aBit) {
  let cell = aBit / 8;
  let offset = aBit % 8;
  let val = aArray[cell];
  return ((val & (1 << offset)) != 0);
}

function probeBloomFilter(aFilter, aString) {
  gCryptoHash.init(Ci.nsICryptoHash.SHA256);
  let stringStream = Cc["@mozilla.org/io/string-input-stream;1"]
                       .createInstance(Ci.nsIStringInputStream);
  stringStream.data = aString;
  gCryptoHash.updateFromStream(stringStream, -1);
  let hash = gCryptoHash.finish(false);
  let h1 = array2int(hash.slice(0, 4)) % (aFilter.byteLength * 8);
  let h2 = array2int(hash.slice(4, 8)) % (aFilter.byteLength * 8);
  let h3 = array2int(hash.slice(8, 12)) % (aFilter.byteLength * 8);
  let h4 = array2int(hash.slice(12, 16)) % (aFilter.byteLength * 8);
  let h5 = array2int(hash.slice(16, 20)) % (aFilter.byteLength * 8);
  let h6 = array2int(hash.slice(20, 24)) % (aFilter.byteLength * 8);
  let h7 = array2int(hash.slice(24, 28)) % (aFilter.byteLength * 8);
  let h8 = array2int(hash.slice(28, 32)) % (aFilter.byteLength * 8);
  return (probeBit(aFilter, h1) && probeBit(aFilter, h2) &&
          probeBit(aFilter, h3) && probeBit(aFilter, h4) &&
          probeBit(aFilter, h5) && probeBit(aFilter, h6) &&
          probeBit(aFilter, h7) && probeBit(aFilter, h8));
}

exports.addToBloomFilter = addToBloomFilter;
exports.probeBloomFilter = probeBloomFilter;
