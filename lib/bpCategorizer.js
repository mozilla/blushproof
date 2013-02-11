/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const blushlist = require("blushlist");
let bpUtil = require("bpUtil");
let speller = require("speller");
let ss = require("simple-storage");
let training_data = require("training_data");

if (!ss.storage.nWords) {
  training_data.forEach(function(line) {
    speller.train(line);
  });
  console.log("Trained speller");
  ss.storage.nWords = speller.nWords;
} else {
  speller.nWords = ss.storage.nWords;
}

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

/**
 * Returns a possibly-empty spelling correction for the query.
 * @param {string} query The string to correct.
 */
function getCorrectSpelling(query) {
  return speller.correct(query);
}
exports.getCorrectSpelling = getCorrectSpelling;
