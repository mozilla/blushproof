/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let blushlist = [
  // subsring, category
  ["facebook", 'social'],
  ["xtube",'porn'],
  ["xxx",'porn'],
  ["okcupid",'dating'],
  ['poker','gambling']
];

// are we in the blushlist?
/** return first substring matching tuple from blushlist, or undefined
  *
  * @returns {list} matching tuple of [string,category], or undefined
  */
function match_blushlist(url) {
  console.log('in match_blushlist');
  for (let entry of blushlist) {
    let substring = entry[0];
    let category = entry[1];
    if (url.indexOf(substring) != -1) {
      console.log("got match:", url);
      return entry;
    } else {
      console.log("no match", url);
    }
  }
  return null;
}

exports.match_blushlist = match_blushlist;
