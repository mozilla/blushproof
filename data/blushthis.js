/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

function init() {
  let blush = document.getElementById("blush");
  let forget = document.getElementById("forget");
  blush.onclick = function() {
    if (forget.checked()) {
      addon.port.emit("forget");
    }
    addon.port.emit("blush");
  };

  let cancel = document.getElementById("cancel");
  cancel.onclick = function() {
    addon.port.emit("cancel");
  }
}
