// This module encapsulates all the micropilot logic. Other modules should only
// ever have to use monitor.record.

let micropilot = require("micropilot");

const { storage } = require("simple-storage");

let monitor = micropilot.Micropilot('tapopenstudy').start();
var tabs = require('tabs');
tabs.on('ready', function () {
  monitor.record({'msg': 'tab ready', 'ts': Date.now()});
});

daily_upload = function _daily_upload() {
  console.log("Daily upload", JSON.stringify(monitor));
  storage.lastupload = Date.now();
  monitor.record({"uploading": storage.lastupload});
  monitor.upload("fake.com", { simulate: true }).then(function(req) {
    console.log(JSON.stringify(req.content));
  });
};

final_upload = function _final_upload() {
  console.log("Fuse blowing");
  // Dump all prefs
  monitor.upload("fake.com", { simulate: true }).then(function(req) {
    console.log(JSON.stringify(req.content));
  });
};

micropilot.Fuse({
  start: storage.lastupload,
  duration: 60 * 1000, /* 10 sec */
  pulseinterval: 10 * 1000,
  pulsefn: daily_upload
}).then(final_upload);

exports.monitor = monitor;
