// This module encapsulates all the micropilot logic. Other modules should only
// ever have to use monitor.record.

let micropilot = require("micropilot");

const { storage } = require("simple-storage");

let monitor = micropilot.Micropilot("blushproof").start();

function daily_upload() {
  // Placeholder for metadata about the upload. We probably want to keep track
  // of the last upload.
  monitor.record({ts: Date.now()});
  // Placeholder for the upload url.
  monitor.upload("fake.com", { simulate: true }).then(function(req) {
    console.log(JSON.stringify(req.content));
  });
};

micropilot.Fuse({
  start: Date.now(),
  // Run forever
  duration: false,
  // Upload every day in milliseconds
  pulseinterval: 24 * 60 * 60 * 1000,
  // (Upload more often for testing)
  // pulseinterval: 10 * 1000,
  pulsefn: daily_upload
});

exports.monitor = monitor;
