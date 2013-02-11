"use strict";

let windowsUtils = require("window/utils");
let windows = require("sdk/windows").browserWindows;
let bpUI = require("bpUI");

function addAwesomeListener(window) {
  if ("chrome://browser/content/browser.xul" != window.location) {
    return;
  }
  let addressBar = window.document.getElementById("urlbar");
  if (!addressBar) {
    return;
  }
  addressBar.addEventListener(
    "keydown",
    function keydown(event) {
      if (event.keyCode != 13) {
        return true;
      }
      // Enter key was pressed
      let address = addressBar.value;
      console.log("address", address);
      if ("porn" != address) {
        return true;
      }
      // Preventing porny search
      event.preventDefault();
      let uri = { "spec" : address, "host" : address };
      bpUI.handleNavigation(window, uri);
      return false;
    },
    false);
}

windows.on("open", function onOpen(window) {
  addAwesomeListener(window);
});

// We don't get the open event for the first window, just attach the listener
// manually
let w = windowsUtils.getMostRecentBrowserWindow();
addAwesomeListener(w);

exports.windows = windows;
