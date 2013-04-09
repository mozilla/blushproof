/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This module contains all of the logic for blushlisting or whitelisting
// domains and/or search queries.

"use strict";

let ss = require("simple-storage");

const blushlist = require("blushlist");
const searchterms = require("searchterms");
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
 * A map of string -> int indicating how many times a host or query belonging
 * to the category represented by the string has been whitelisted.
 */
if (!ss.storage.whitelistedCategories) {
  ss.storage.whitelistedCategories = {};
}

/**
 * A map of string -> bool indicating that searches with the given query
 * string should not be opened in a private window. This persists across
 * restarts.
 */
if (!ss.storage.whitelistedQueries) {
  ss.storage.whitelistedQueries = {};
}

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

/**
 * Increments the whitelist count of the given category. The "user" category
 * cannot be whitelisted.
 * @param {string} aCategory the category to increment the whitelist count of
 */
function incrementWhitelistedCategory(aCategory) {
  if (aCategory == "user") {
    return;
  }

  if (!ss.storage.whitelistedCategories[aCategory]) {
    ss.storage.whitelistedCategories[aCategory] = 1;
  } else {
    ss.storage.whitelistedCategories[aCategory]++;
  }
}

/**
 * Returns true if entries in the given category have been whitelisted
 * enough to consider the entire category whitelisted.
 * @param {string} aCategory the category in question
 */
function isCategoryWhitelisted(aCategory) {
  let whitelistCount = ss.storage.whitelistedCategories[aCategory];
  return (whitelistCount ? whitelistCount >= 3 : false);
}

/**
 * Adds a domain to the list of domains to not be opened in a private window.
 * @param {string} aHost the host from which to get a domain to be whitelisted
 */
exports.whitelistHost = function(aHost) {
  let key = bpUtil.getKeyForHost(aHost);
  ss.storage.whitelistedDomains[key] = true;
  incrementWhitelistedCategory(getCategoryForHost(aHost));
}

/**
 * Adds a query to the list of queries to not be opened in a private window.
 * @param {string} aQuery the query to whitelist
 */
exports.whitelistQuery = function(aQuery) {
  ss.storage.whitelistedQueries[aQuery] = true;
  incrementWhitelistedCategory(isQueryEmbarassing(aQuery));
}

/**
 * Returns true if the base domain of the given host has been whitelisted.
 * @param {string} aHost the host in question.
 */
exports.isHostWhitelisted = function isHostWhitelisted(aHost) {
  let key = bpUtil.getKeyForHost(aHost);
  console.log("Checking host", key);
  return (ss.storage.whitelistedDomains[key] ||
          isCategoryWhitelisted(getCategoryForHost(aHost)));
}

/**
 * Returns true if the query has been whitelisted.
 * @param {string} aQuery the query in question.
 */
exports.isQueryWhitelisted = function isQueryWhitelisted(aQuery) {
  let key = bpUtil.getKeyForQuery(aQuery);
  console.log("Checking query", key);
  return (ss.storage.whitelistedQueries[key] ||
          isCategoryWhitelisted(getCategoryForQuery(aQuery)));
}

/** Returns the category of the domain on the blushlist.
 *
 * @param aHost The nsIURI.host to check.
 * @returns A possibly-null string containing the category of the domain.
 */
function getCategoryForHost(aHost) {
  let key = bpUtil.getKeyForHost(aHost);
  return ss.storage.blushlist.map[key];
}
exports.getCategoryForHost = getCategoryForHost;

/** Adds the domain to the blushlist, with category "user". Deletes the domain
 * from the whitelist, if it exists.
 * @param domain The nsURI.host to add.
 * @returns true on success.
 */
function addToBlushlist(aHost) {
  let key = bpUtil.getKeyForHost(aHost);
  ss.storage.blushlist.map[key] = "user";
  if (ss.storage.whitelistedDomains[key]) {
    delete ss.storage.whitelistedDomains[key];
  }
  return true;
}
exports.addToBlushlist = addToBlushlist;

function getCategoryForQuery(aQuery) {
  let key = bpUtil.getKeyForQuery(aQuery);
  return ss.storage.searchterms.map[key];
}
exports.getCategoryForQuery = getCategoryForQuery;
