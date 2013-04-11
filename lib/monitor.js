// This module encapsulates all the micropilot logic. Other modules should only
// ever have to use monitor.record.

let micropilot = require("micropilot");

const { storage } = require("simple-storage");

let monitor = micropilot.Micropilot("blushproof").start();

//daily_upload = function _daily_upload() {
daily_upload = function _daily_upload() {
  console.log("Daily upload", JSON.stringify(monitor));
  // Placeholder for metadata about the upload. We probably want to keep track
  // of the last upload.
  monitor.record({ts: Date.now()});
  monitor.upload("fake.com", { simulate: true }).then(function(req) {
    console.log(JSON.stringify(req.content));
  });
};

micropilot.Fuse({
  start: storage.lastupload,
  duration: 60 * 1000, /* 10 sec */
  pulseinterval: 10 * 1000,
  pulsefn: daily_upload
});

exports.monitor = monitor;
