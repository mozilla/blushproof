"use strict";

let main = require("main");
let bpUtil = require("bpUtil");
let bpUI = require("bpUI");
let bpCategorizer = require("bpCategorizer");
const { recordEvent, monitor, kEvents } = require("monitor");
let ss = require("simple-storage");
let winUtils = require("sdk/window/utils");
let tabs = require("sdk/tabs");
let { nsHttpServer } = require("sdk/test/httpd");
const { Cc, Ci, Cu } = require("chrome");
const { NetUtil } = Cu.import("resource://gre/modules/NetUtil.jsm", {});
const { defer, resolve, promised } = require("sdk/core/promise");
const group = function (array) { return promised(Array).apply(null, array); };

// The only URL we can visit
const gUrl = "http://localhost:4444/";
// The event queue that we expect
let gEvents = [];
// Global assert object
let gAssert = null;

/**
 * Test that we recorded what we expected, then clear the monitor.
 * @param expectedContents
 * @return promise
 */
function testMonitor() {
  return monitor.upload("http://example.com", { simulate: true }).
    then(function checkContents(request) {
      var deferred = defer();
      let events = JSON.parse(request.content).events;
      console.log("EVENTS", JSON.stringify(events));
      console.log("EXPECTED EVENTS", JSON.stringify(gEvents));
      gAssert.equal(events.length, gEvents.length);
      for (let i = 0; i < events.length; ++i) {
        // Ignore the timestamp field
        gAssert.equal(events[i].event, gEvents[i]);
        // Micropilot sticks an eventstoreid field on every record
        gAssert.equal(events[i].eventstoreid, i + 1);
      }
      deferred.resolve(true);
      return deferred.promise;
    }).
    // This clear is not working.
    // then(monitor.clear).
    then(null, function() { console.log("couldn't clear"); });
}

/**
 * Returns a promise whose resolution is an event and a message.
 * @param aURL same as previously mentioned functions
 * @param aDoNav a boolean indicating the page should be navigated if true
 * @return promise resolving to the event and a message
 */
function maybeShowPanel(aURL, aDoNav) {
  let win = winUtils.getMostRecentBrowserWindow();
  let deferred = defer();
  let consentPanelShownListener = null;
  consentPanelShownListener = function(event) {
    gAssert.pass("Got consent panel");
    win.removeEventListener("ConsentPanelShown", consentPanelShownListener);
    deferred.resolve({event: event, message: "panel shown"});
  };

  win.addEventListener("ConsentPanelShown", consentPanelShownListener);

  // Using 'currentBrowser.contentWindow.location = aURL;'
  // somehow bypasses our content policy. I'm guessing it has something to do
  // with chrome privileges, but I'm too annoyed with it to figure it out now.
  if (aDoNav) {
    tabs[0].url = aURL;
  }
  return deferred.promise;
}

/**
 * Returns a promise whose resolution is an event and a message.
 * @param aURL same as previously mentioned functions
 * @param aDoNav a boolean indicating the page should be navigated if true
 * @return promise resolving to the event and a message
 */
function maybeShowPage(aURL, aDoNav) {
  let win = winUtils.getMostRecentBrowserWindow();
  let currentBrowser = win.gBrowser.selectedBrowser;

  let deferred = defer();
  // We resolve the promise with the event and a message
  let loadListener = null;
  loadListener = function(event) {
    if (event.target.documentURI == aURL) {
      gAssert.pass("Got promised url", aURL);
      currentBrowser.removeEventListener("load", loadListener);
      deferred.resolve({event: event, message: "page shown"});
    }
  };

  currentBrowser.addEventListener("load", loadListener, true);

  // Using 'currentBrowser.contentWindow.location = aURL;'
  // somehow bypasses our content policy. I'm guessing it has something to do
  // with chrome privileges, but I'm too annoyed with it to figure it out now.
  if (aDoNav) {
    tabs[0].url = aURL;
  }
  return deferred.promise;
}

function openInNormalWindow(response) {
  // TODO: This should resolve only when the post message has been processed
  return resolve(response.event.detail.postMessage("continue"));
}

/**
 * Given a url and a continuation to call upon completion, this function loads
 * up the url and expects that the consent panel will be shown.
 * @param aURL a string representing a url to load
 */
function testExpectConsentPanelThenWhitelist() {
  console.log("testExpectConsentPanelThenWhitelist");
  let key = bpUtil.getKeyForHost("localhost");
  ss.storage.blushlist.map[key] = "testing";
  gAssert.equal(bpCategorizer.getCategoryForHost("localhost"),
               "testing",
               "sanity check that putting 'localhost' on the blushlist works");
  gEvents = [kEvents.BLUSHY_SITE,
             kEvents.OPEN_NORMAL,
             kEvents.WHITELISTED_SITE];
  return maybeShowPanel(gUrl, true).
    then(openInNormalWindow).
    then(function() { return maybeShowPage(gUrl, false); }).
    then(testMonitor);
}

/**
 * Given a string representing a URI and a callback to call upon completion,
 * this asks the async history service if the URI has been visited.
 * @param aURIString a string representing a URI
 * @return promise
 */
/**
 * The second time we load localhost:4444, we don't expect to see a consent
 * panel, because we whitelisted it in the previous test.
 */
function testExpectNoConsentPanelWhitelisted() {
  console.log("testExpectConsentPanelThenWhitelist");
  gEvents.push(kEvents.WHITELISTED_SITE);
  return maybeShowPage(gUrl, true).
    then(testMonitor);
}

/**
 * The third time we load localhost:4444, we don't expect to see a consent
 * panel, because we've removed it from the blushlist entirely.
 */
function testExpectNoConsentPanelNotOnBlushlist() {
  let key = bpUtil.getKeyForHost("localhost");
  delete ss.storage.blushlist.map[key];
  // We have to clear these together to keep things consistent.
  delete ss.storage.whitelistedDomains[key];
  delete ss.storage.whitelistedCategories["testing"];
  gAssert.equal(bpCategorizer.getCategoryForHost("localhost"),
                      null,
                      "'localhost' should not be on the blushlist");
  gAssert.ok(!ss.storage.whitelistedDomains["localhost"],
                   "'localhost' should not be on the domain whitelist");
  // No new events
  return maybeShowPage(gUrl, true).
    then(testMonitor);
}

function promiseVisitedUri(aURIString) {
  let deferred = defer();
  let uri = NetUtil.newURI(aURIString, null, null);
  let asyncHistory = Cc["@mozilla.org/browser/history;1"]
                       .getService(Ci.mozIAsyncHistory);
  asyncHistory.isURIVisited(uri, function(aURI, aVisitedStatus) {
    gAssert.equal(uri, aURI);
    deferred.resolve(aVisitedStatus);
  });
  return deferred.promise;
}

function promiseBlushHidden(win) {
  let deferred = defer();
  let blushPanelHiddenListener = function(event) {
    win.removeEventListener("BlushPanelHidden", blushPanelHiddenListener);
    deferred.resolve();
  }
  win.addEventListener("BlushPanelHidden", blushPanelHiddenListener);
  return deferred.promise;
}

function promiseBlushButton(win, aForget) {
  let deferred = defer();
  bpUI.blushButton.panel.show();
  let blushPanelShownListener = function(event) {
    console.log("pushing blush button");
    win.removeEventListener("BlushPanelShown", blushPanelShownListener);
    if (aForget) {
      event.detail.postMessage("forget");
    }
    event.detail.postMessage("blush");
    deferred.resolve();
  };
  win.addEventListener("BlushPanelShown", blushPanelShownListener);
  return deferred.promise;
}

function testBlushThis() {
  console.log("testBlushThis");
  let win = winUtils.getMostRecentBrowserWindow();

  gEvents = gEvents.concat([kEvents.ADD_BLUSHLIST, kEvents.BLUSHY_SITE]);
  return maybeShowPage(gUrl, true).
    then(function() { return promiseBlushButton(win, false); }).
    then(function() { return promiseBlushHidden(win); }).
    then(function() { return promiseVisitedUri(gUrl); }).
    then(function(aVisited) {
      gAssert.ok(aVisited);
      return maybeShowPanel(gUrl, true); }).
    then(function(response) {
      response.event.detail.hide();
      return testMonitor(); });
}

function testBlushAndForgetThis() {
  let key = bpUtil.getKeyForHost("localhost");
  delete ss.storage.blushlist.map[key];
  let win = winUtils.getMostRecentBrowserWindow();
  console.log("testBlushAndForgetThis");
  gEvents = gEvents.concat([kEvents.FORGET_SITE, kEvents.ADD_BLUSHLIST,
                            kEvents.BLUSHY_SITE]);
  return maybeShowPage(gUrl, true).
    then(function() { return promiseBlushButton(win, true); }).
    then(function() { return promiseBlushHidden(win); }).
    then(function() { return promiseVisitedUri(gUrl); }).
    then(function(aVisited) {
      console.log("visited status", aVisited);
      return maybeShowPanel(gUrl, true);
    }).
    then(function(response) {
      response.event.detail.hide();
      return testMonitor(); });
}

// In case the function name isn't clear: this test checks that we properly
// remove a domain from the blushlist if the user used the "Blush This!"
// button on it.
function testUnblushUserBlushedSite() {
  console.log("testUnblushUserBlushedSite");
  gAssert.equal(bpCategorizer.getCategoryForHost("localhost"),
                      "user",
                      "localhost should be in category 'user'");
  gEvents = gEvents.concat([kEvents.BLUSHY_SITE, kEvents.OPEN_NORMAL,
                            kEvents.WHITELISTED_SITE]);
  return maybeShowPanel(gUrl, true).
    then(openInNormalWindow).
    then(function() { return maybeShowPage(gUrl, false); }).
    then(function() {
      gAssert.ok(!bpCategorizer.getCategoryForHost("localhost"),
                "localhost should have no category now");
      gAssert.ok(!ss.storage.whitelistedCategories["user"],
                "the 'user' category should never be whitelisted");
      return testMonitor(); });
}

function testWhitelistCategory() {
  let key = bpUtil.getKeyForHost("localhost");
  ss.storage.blushlist.map[key] = "testing";
  // we have to clear these together to keep things consistent
  delete ss.storage.whitelistedDomains[key];
  delete ss.storage.whitelistedCategories["testing"];

  // we're not actually going to visit these sites - we just want them on
  // the blushlist so we can whitelist them (which we do manually, here)
  let key = bpUtil.getKeyForHost("example.com");
  ss.storage.blushlist.map[key] = "testing";
  bpCategorizer.whitelistHost("example.com");
  let key = bpUtil.getKeyForHost("other-example.com");
  ss.storage.blushlist.map[key] = "testing";
  bpCategorizer.whitelistHost("other-example.com");
  // we're not whitelisting this site - this is how we see that this
  // functionality worked
  let key = bpUtil.getKeyForHost("thirdsite.com");
  ss.storage.blushlist.map[key] = "testing";
  gAssert.ok(!bpCategorizer.isHostWhitelisted("thirdsite.com"));
  // only 2 sites in the "testing" category have been whitelisted, so we
  // expect a consent panel here
  console.log("testWhitelistCategory");
  gEvents = gEvents.concat([kEvents.BLUSHY_SITE, kEvents.OPEN_NORMAL,
                            kEvents.WHITELISTED_SITE]);
  return maybeShowPanel(gUrl, true).
    then(openInNormalWindow).
    then(function() { return maybeShowPage(gUrl, false); }).
    then(function() {
      gAssert.ok(bpCategorizer.isHostWhitelisted("thirdsite.com"));
      return testMonitor(); });
}

exports["test main async"] = function(assert, done) {
  // Set our global assert object
  gAssert = assert;
  let httpServer = new nsHttpServer();
  httpServer.start(4444);
  testExpectConsentPanelThenWhitelist().
    then(testExpectNoConsentPanelWhitelisted).
    then(testExpectNoConsentPanelNotOnBlushlist).
    then(testBlushThis).
    then(testBlushAndForgetThis).
    then(testUnblushUserBlushedSite).
    then(testWhitelistCategory).
    then(function() {
      console.log("we're done here, right?");
      main.onUnload();
      httpServer.stop(done);
      done()
    }).
    then(null, function() {
      assert.fail("Failed");
      done();
    });
};

/**
 * We have to call main's main() to load up blushproof. After that, we
 * run our tests.
 */
main.main();
require("sdk/test").run(exports);
