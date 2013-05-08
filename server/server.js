"use strict";

var http = require("http");
var sqlite3 = require("sqlite3").verbose();
var db;

function createDB() {
  console.log("creating if necessary...");
  db = new sqlite3.Database("events.sqlite3", createTable);
}

function createTable() {
  console.log("creating table if necessary...");
  db.run("CREATE TABLE IF NOT EXISTS events(timestamp INTEGER, event TEXT, userID TEXT, uploadID TEXT)", startServer);
}

function startServer() {
  console.log("starting server...");
  http.createServer(function(req, res) {
    var jsonstr = "";
    req.setEncoding("utf8");
    req.on("data", function(str) {
      jsonstr += str;
    });
    req.on("end", function() {
      var json = {};
      try {
        json = JSON.parse(jsonstr);
      } catch (e) {} // we do the error checking below:
      if (!json.events || !json.personid || !json.uploadid) {
        res.writeHead(400, {"Content-Type": "text/plain"});
        res.end("Bad Request");
        return;
      }
      var events = json.events;
      var userID = json.personid;
      var uploadID = json.uploadid;
      for (var i in events) {
        var evt = events[i];
        db.run("INSERT INTO events VALUES (:timestamp, :event, :userID, :uploadID)",
               { ":timestamp" : evt.timestamp,
                 ":event" : evt.event,
                 ":userID" : userID,
                 ":uploadID" : uploadID });
      }

      db.wait(function() {
        res.writeHead(200, {"Content-Type": "text/plain"});
        res.end("OK!");
      });
    });
  }).listen(8158);
}

createDB();
