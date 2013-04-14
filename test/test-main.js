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
 * Returns a promise that resolves when we recorded what we expected, then
 * clear the monitor.
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
 * Resolves when we (optionally) navigate to aURL and show the consent panel.
 * @param aURL The URL to navigate to.
 * @param aDoNav a boolean indicating the page should be navigated if true
 * @return promise resolving to the event and a message
 */
function maybeShowConsentPanel(aURL, aDoNav) {
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
 * Resolves when we (optionally) navigate to a URL and load the page.
 * @param aURL The URL to navigate to.
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

// Wrapper function for choosing "Open in normal window"
function openInNormalWindow(response) {
  // TODO: This should resolve only when the post message has been processed
  return resolve(response.event.detail.postMessage("continue"));
}

/**
 * Returns a promise that resolves with visited status for the given URL.
 */
function isURIVisited(aURIString) {
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

/**
 * Returns a promise that resolves when the blush panel is shown and the button
 * is pushed, and the panel is hidden.
 */
function maybePushBlushButton(win, aForget) {
  let deferred = defer();
  bpUI.blushButton.panel.show();

  let blushPanelShownListener = function(event) {
    console.log("pushing blush button");
    win.removeEventListener("BlushPanelShown", blushPanelShownListener);
    if (aForget) {
      event.detail.postMessage("forget");
    }
    event.detail.postMessage("blush");
  };

  let blushPanelHiddenListener = function(event) {
    win.removeEventListener("BlushPanelHidden", blushPanelHiddenListener);
    deferred.resolve();
  }

  win.addEventListener("BlushPanelHidden", blushPanelHiddenListener);
  win.addEventListener("BlushPanelShown", blushPanelShownListener);
  return deferred.promise;
}

/**
 * Put a URL on the blushlist, navigate to it, check the consent panel is
 * shown, open it in a normal window, then check that it's on the whitelist.
 * @return promise
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
  return maybeShowConsentPanel(gUrl, true).
    then(openInNormalWindow).
    then(function() { return maybeShowPage(gUrl, false); }).
    then(testMonitor);
}

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
/**
 * Tests that we can push "blush this" and the next time we visit the site, a
 * consent panel shows up.
 */
function testBlushThis() {
  console.log("testBlushThis");
  let win = winUtils.getMostRecentBrowserWindow();

  gEvents = gEvents.concat([kEvents.ADD_BLUSHLIST, kEvents.BLUSHY_SITE]);
  return maybeShowPage(gUrl, true).
    then(function() { return maybePushBlushButton(win, false); }).
    then(function() { return isURIVisited(gUrl); }).
    then(function(aVisited) {
      gAssert.ok(aVisited);
      return maybeShowConsentPanel(gUrl, true); }).
    then(function(response) {
      response.event.detail.hide();
      return testMonitor(); });
}

/**
 * Tests that we can push "blush this" with "forget this site" checked and the
 * next time we visit the site, a consent panel shows up, and the URL hasn't
 * been visited.
 */
function testBlushAndForgetThis() {
  let key = bpUtil.getKeyForHost("localhost");
  delete ss.storage.blushlist.map[key];
  let win = winUtils.getMostRecentBrowserWindow();
  console.log("testBlushAndForgetThis");
  gEvents = gEvents.concat([kEvents.FORGET_SITE, kEvents.ADD_BLUSHLIST,
                            kEvents.BLUSHY_SITE]);
  return maybeShowPage(gUrl, true).
    then(function() { return maybePushBlushButton(win, true); }).
    then(function() { return isURIVisited(gUrl); }).
    then(function(aVisited) {
      console.log("visited status", aVisited);
      return maybeShowConsentPanel(gUrl, true);
    }).
    then(function(response) {
      response.event.detail.hide();
      return testMonitor(); });
}

// Tests that we properly remove a domain from the blushlist if the user used
// the "Blush This!" button on it.
function testUnblushUserBlushedSite() {
  console.log("testUnblushUserBlushedSite");
  gAssert.equal(bpCategorizer.getCategoryForHost("localhost"),
                      "user",
                      "localhost should be in category 'user'");
  gEvents = gEvents.concat([kEvents.BLUSHY_SITE, kEvents.OPEN_NORMAL,
                            kEvents.WHITELISTED_SITE]);
  return maybeShowConsentPanel(gUrl, true).
    then(openInNormalWindow).
    then(function() { return maybeShowPage(gUrl, false); }).
    then(function() {
      gAssert.ok(!bpCategorizer.getCategoryForHost("localhost"),
                "localhost should have no category now");
      gAssert.ok(!ss.storage.whitelistedCategories["user"],
                "the 'user' category should never be whitelisted");
      return testMonitor(); });
}

/**
 * Tests that we whitelist the entire category if domains in that category have
 * been whitelisted 3 times.
 */
function testWhitelistCategory() {
  console.log("testWhitelistCategory");

  let key = bpUtil.getKeyForHost("localhost");
  ss.storage.blushlist.map[key] = "testing";

  // we have to clear these together to keep things consistent
  delete ss.storage.whitelistedDomains[key];
  delete ss.storage.whitelistedCategories["testing"];

  // Whitelist 2 different sites with category "testing"
  let key = bpUtil.getKeyForHost("example.com");
  ss.storage.blushlist.map[key] = "testing";
  bpCategorizer.whitelistHost("example.com");

  key = bpUtil.getKeyForHost("other-example.com");
  ss.storage.blushlist.map[key] = "testing";
  bpCategorizer.whitelistHost("other-example.com");

  // Add thirdsite.com to the blushlist with category "testing".
  key = bpUtil.getKeyForHost("thirdsite.com");
  ss.storage.blushlist.map[key] = "testing";
  gAssert.ok(!bpCategorizer.isHostWhitelisted("thirdsite.com"));

  gEvents = gEvents.concat([kEvents.BLUSHY_SITE, kEvents.OPEN_NORMAL,
                            kEvents.WHITELISTED_SITE]);
  return maybeShowConsentPanel(gUrl, true).
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
      main.onUnload();
      httpServer.stop(done);
      done()
    }).
    then(null, function() {
      assert.fail("Failed somewhere");
      done();
    });
};

/**
 * We have to call main's main() to load up blushproof. After that, we
 * run our tests.
 */
main.main();
require("sdk/test").run(exports);
