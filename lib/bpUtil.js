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
