/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// TODO(mmc): Move to data
let blushlist = [
  // substring, category
  ["facebook", 'social'],
  ["xtube",'porn'],
  ["xxx",'porn'],
  ["okcupid",'dating'],
  ['poker','gambling']
];

/** Return the first blushlist tuple matching the url.
 *
 * @param url The location to check.
 * @returns {list} matching tuple of [string,category], or null.
 */
function matchBlushlist(url) {
  console.log('in match_blushlist');
  for (let entry of blushlist) {
    let substring = entry[0];
    if (url.indexOf(substring) != -1) {
      console.log("got match:", url);
      return entry;
    } else {
      console.log("no match", url);
    }
  }
  return null;
}

exports.matchBlushlist = matchBlushlist;
