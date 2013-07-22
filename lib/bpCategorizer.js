/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This module contains all of the logic for blushlisting or whitelisting
// domains and/or search queries.

"use strict";

let { storage } = require("simple-storage");

const blushlist = require("blushlist");
const searchterms = require("searchterms");
let bpUtil = require("bpUtil");

/**
 * A map of string -> bool indicating that any host with a base domain
 * represented by the string should not be opened in a private window. This
 * persists across restarts.
 */
if (!storage.whitelistedDomains) {
  storage.whitelistedDomains = {};
}

/**
 * A map of string -> int indicating how many times a host or query belonging
 * to the category represented by the string has been whitelisted.
 */
if (!storage.whitelistedCategories) {
  storage.whitelistedCategories = {};
}

/**
 * A map of string -> bool indicating that searches with the given query
 * string should not be opened in a private window. This persists across
 * restarts.
 */
if (!storage.whitelistedQueries) {
  storage.whitelistedQueries = {};
}

// initialize things to an empty state if we're starting from scratch
if (!storage.blushlist || !storage.blushlist.map ||
    !storage.blushlist.version) {
  storage.blushlist = {};
  storage.blushlist.map = {};
  storage.blushlist.version = "";
}

if (!storage.searchterms || !storage.searchterms.map ||
    !storage.searchterms.version) {
  storage.searchterms = {};
  storage.searchterms.map = {};
  storage.searchterms.version = "";
}

update(storage.blushlist, blushlist);
update(storage.searchterms, searchterms);

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

  if (!storage.whitelistedCategories[aCategory]) {
    storage.whitelistedCategories[aCategory] = 1;
  } else {
    storage.whitelistedCategories[aCategory]++;
  }
}

/**
 * Returns true if entries in the given category have been whitelisted
 * enough to consider the entire category whitelisted.
 * @param {string} aCategory the category in question
 */
function isCategoryWhitelisted(aCategory) {
  let whitelistCount = storage.whitelistedCategories[aCategory];
  return (whitelistCount >= 3);
}

/**
 * Adds a domain to the list of domains to not be opened in a private window.
 * @param {string} aHost the host from which to get a domain to be whitelisted
 */
exports.whitelistHost = function(aHost) {
  let key = bpUtil.getKeyForHost(aHost);
  let category = getCategoryForHost(aHost);
  whitelistCommon(key, category, storage.whitelistedDomains,
                  storage.blushlist.map);
}

/**
 * Adds a query to the list of queries to not be opened in a private window.
 * @param {string} aQuery the query to whitelist
 */
exports.whitelistQuery = function(aQuery) {
  let key = bpUtil.getKeyForQuery(aQuery);
  let category = getCategoryForQuery(aQuery);
  whitelistCommon(key, category, storage.whitelistedQueries,
                  storage.searchterms.map);
}

/**
 * Common routine for whitelistHost and whitelistQuery. If the category is
 * "user", the entry must be removed from the blushlist. Otherwise, increment
 * the count of the whitelisted category.
 * @param aKey the key corresponding to the domain or query to whitelist
 * @param aCategory the category of the item to whitelist
 * @param aWhitelistMap the map implementing the whitelist
 * @param aBlushlistMap the map implementing the blushlist
 */
function whitelistCommon(aKey, aCategory, aWhitelistMap, aBlushlistMap) {
  aWhitelistMap[aKey] = true;
  if (aCategory == "user") {
    delete aBlushlistMap[aKey];
  } else {
    incrementWhitelistedCategory(aCategory);
  }
}

/**
 * Returns true if the base domain of the given host has been whitelisted.
 * @param {string} aHost the host in question.
 */
exports.isHostWhitelisted = function isHostWhitelisted(aHost) {
  let key = bpUtil.getKeyForHost(aHost);
  return (storage.whitelistedDomains[key] ||
          isCategoryWhitelisted(getCategoryForHost(aHost)));
}

/**
 * Returns true if the query has been whitelisted.
 * @param {string} aQuery the query in question.
 */
exports.isQueryWhitelisted = function isQueryWhitelisted(aQuery) {
  let key = bpUtil.getKeyForQuery(aQuery);
  return (storage.whitelistedQueries[key] ||
          isCategoryWhitelisted(getCategoryForQuery(aQuery)));
}

/** Returns the category of the domain on the blushlist.
 *
 * @param aHost The nsIURI.host to check.
 * @returns A possibly-null string containing the category of the domain.
 */
function getCategoryForHost(aHost) {
  let key = bpUtil.getKeyForHost(aHost);
  return storage.blushlist.map[key];
}
exports.getCategoryForHost = getCategoryForHost;

/** Adds the domain to the blushlist, with category "user". Deletes the domain
 * from the whitelist, if it exists.
 * @param domain The nsURI.host to add.
 * @returns true on success
 */
function addToBlushlist(aHost) {
  let key = bpUtil.getKeyForHost(aHost);
  storage.blushlist.map[key] = "user";
  if (storage.whitelistedDomains[key]) {
    delete storage.whitelistedDomains[key];
  }
  return true;
}
exports.addToBlushlist = addToBlushlist;

function getCategoryForQuery(aQuery) {
  let key = bpUtil.getKeyForQuery(aQuery);
  return storage.searchterms.map[key];
}
exports.getCategoryForQuery = getCategoryForQuery;

let gCategoryMappings = {
  adult: "adult",
  gossip: "gossip",
  drugs: "drugs- and alcohol-related",
  gambling: "gambling",
  gaming: "gaming",
  medical: "medical",
  social: "social"
};

/** Given an internal category name, maps it to an externally displayable one.
 * @param aCategory the internal category (one of "adult", "gossip", "drugs",
 * "gambling", "gaming", "medical", or "social")
 */
function getExternalCategoryName(aCategory) {
  return gCategoryMappings[aCategory];
}
exports.getExternalCategoryName = getExternalCategoryName;
