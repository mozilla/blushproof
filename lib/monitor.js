// This module encapsulates all the micropilot logic. Other modules should only
// ever have to use monitor.record.

const micropilot = require("micropilot");
const { storage } = require("simple-storage");
const myprefs = require("simple-prefs").prefs;
const timers = require("timers");
const { defer } = require("sdk/core/promise");

// Our AWS box
const UPLOAD_URL = "https://blushproof.org/";
// Upload every day in milliseconds
const UPLOAD_INTERVAL = 24 * 60 * 60 * 1000;
// Check if it's time to upload every hour, in milliseconds
const UPLOAD_CHECK_INTERVAL = 60 * 60 * 1000;
const UPLOAD_VERSION = "0.9";

let monitor = micropilot.Micropilot("blushproof").start();
/**
 * A helper function to record time-stamped events. Times are modulo the
 * most recent hour.
 * @param eventName {string} The name of the event.
 * @return promise
 */
//micropilot.Micropilot.prototype.recordEvent = function recordEvent(eventName) {
exports.recordEvent = function recordEvent(eventName) {
  let d = new Date();
  d.setMinutes(0);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return monitor.record({ timestamp: d.getTime() / 1000,
                          event: eventName,
                          version: UPLOAD_VERSION });
};

function maybeUploadAndClear() {
  let deferred = defer();
  let nowMillis = (new Date()).getTime();
  if (!storage.lastUploadMillis ||
      storage.lastUploadMillis + UPLOAD_INTERVAL < nowMillis) {
    storage.lastUploadMillis = nowMillis;
    let options = { simulate: false }
    if (!myprefs.enable_reporting) {
      options.simulate = true;
    }
    // We might lose events between when this.upload() returns and this.clear()
    monitor.stop();
    monitor.upload(UPLOAD_URL, options).
      then(function() { return monitor.clear(); }).
      then(function() {
        monitor.start();
        deferred.resolve();
      });
  } else {
    deferred.resolve();
  }
  return deferred.promise;
}

timers.setInterval(maybeUploadAndClear, UPLOAD_CHECK_INTERVAL);

exports.monitor = monitor;
const kEventNames = exports.kEvents = {
  ADD_BLUSHLIST: "add-blushlist",
  BLUSHY_QUERY: "blushy-query",
  BLUSHY_SITE: "blushy-site",
  FORGET_SITE: "forget-site",
  OPEN_NORMAL: "open-normal",
  OPEN_PRIVATE: "open-private",
  REMOVE_BLUSHLIST: "remove-blushlist",
  WHITELISTED_QUERY: "whitelisted-query",
  WHITELISTED_SITE: "whitelisted-site"
};
