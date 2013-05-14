"use strict";

var Promise = require("promise");
var http = require("http");
var sqlite3 = require("sqlite3").verbose();
var db = null;

/**
 * Creates the database in the file 'events.sqlite'.
 * Returns a promise.
 */
function createDB() {
  var promise = new Promise(function(resolve, reject) {
    console.log("creating DB if necessary...");
    db = new sqlite3.Database("events.sqlite", resolve());
  });
  return promise;
}

/**
 * Sets up the database.
 * Returns a promise.
 * The database contains a single tabled named 'events'.
 * events has the following columns:
 * uploadTS (INTEGER): the time the event list containing the event was uploaded
 * uploadID (TEXT): a unique ID for the event list containing the event
 * eventTS (INTEGER): time of the event, truncated to the hour
 * eventSTR (TEXT): a string describing the event
 * userID (TEXT): a unique ID for the user that performed the event
 * bpVersion (TEXT): the version of blushproof in use
 * All times are in seconds.
 */
function createTable() {
  var promise = new Promise(function (resolve, reject) {
    console.log("creating table if necessary...");
    db.run("CREATE TABLE IF NOT EXISTS events(" +
           "uploadTS INTEGER, uploadID TEXT," +
           "eventTS INTEGER, eventSTR TEXT," +
           "userID TEXT, bpVersion TEXT)",
           resolve());
  });
  return promise;
}

/**
 * Given a string representing a json blob, adds any events to the database.
 * Returns a promise.
 * The expected structure of the blob is as follows:
 * {
 *   events: (a list of events)
 *   personid: (a string representing a unique ID of a user)
 *   uploadid: (a string representing a unique ID of an upload)
 *   ts: (the time of the upload)
 *   version: (the version of blushproof)
 * }
 *
 * where the structure of an 'event' is as follows:
 * {
 *   timestamp: (the time of the event, truncated to the hour)
 *   event: (a string describing the event)
 * }
 *
 * All times are in seconds.
 */
function handleData(jsonString) {
  var promise = new Promise(function(resolve, reject) {
    var json = {};
    var badResult = { status: 400, value: "Bad Request" };
    var goodResult = { status: 200, value: "OK!" };
    var result = goodResult;
    try {
      json = JSON.parse(jsonString);
    } catch (e) {} // we do the error checking below:
    if (!json.events || !json.personid || !json.uploadid || !json.ts) {
      resolve(badResult);
    } else {
      for (var i in json.events) {
        var evt = json.events[i];
        if (!evt.timestamp || !evt.event) {
          result = badResult;
          break;
        }
        db.run("INSERT INTO events VALUES (" +
               ":uploadTS, :uploadID, :eventTS, " +
               ":eventSTR, :userID, :bpVersion)",
               { ":uploadTS"  : json.ts,
                 ":uploadID"  : json.uploadid,
                 ":eventTS"   : evt.timestamp,
                 ":eventSTR"  : evt.event,
                 ":userID"    : json.personid,
                 ":bpVersion" : "XXX" });
      }
    }

    db.wait(function() {
      resolve(result);
    });
  });
  return promise;
}

function handleRequest(request, response) {
  var jsonString = "";
  request.setEncoding("utf8");
  request.on("data", function(str) {
    jsonString += str;
  });
  request.on("end", function() {
    handleData(jsonString).then(function(result) {
      response.writeHead(result.status, {"Content-Type": "text/plain"});
      response.end(result.value);
    });
  });
}

function startServer() {
  console.log("starting server...");
  var server = http.createServer(handleRequest);
  server.listen(8158);
}

function main() {
  createDB().then(createTable().then(startServer));
}

main();
