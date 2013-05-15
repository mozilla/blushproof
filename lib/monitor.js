// This module encapsulates all the micropilot logic. Other modules should only
// ever have to use monitor.record.

const micropilot = require("micropilot");
const { storage } = require("simple-storage");
const myprefs = require("simple-prefs").prefs;

// Our AWS box
const UPLOAD_URL = "https://blushproof.org/";
// Upload every day in milliseconds
const PULSE_INTERVAL = 24 * 60 * 60 * 1000;

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
  return monitor.record({timestamp: d.getTime() / 1000, event: eventName});
};

function uploadAndClear() {
  options = { simulate: false }
  if (!myprefs.enable_reporting) {
    options.simulate = true;
  }
  // We might lose events between when this.upload() returns and this.clear()
  return monitor.upload(UPLOAD_URL, options).then(function() { monitor.clear() });
};

// Only start the Fuse to upload results if reporting is enabled
let f = micropilot.Fuse({
  start: Date.now(),
  // Run forever
  duration: Number.MAX_VALUE,
  // Upload daily
  pulseinterval: PULSE_INTERVAL,
  pulsefn: uploadAndClear
});

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
