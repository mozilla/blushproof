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
const kUrl = "http://localhost:4444/";

/**
 * Test that we recorded what we expected, then clear the monitor.
 * @param expectedContents
 * @return promise
 */
function testMonitor(assert, expectedEvents) {
  console.log("trying to call test monitor");
  return monitor.upload("https://example.com", {simulate: true}).then(
    function checkContents(request) {
      var deferred = defer();
      let events = JSON.parse(request.content).events;
      //console.log("TEST MONITOR", JSON.stringify(request.content));
      console.log("EVENTS", JSON.stringify(events));
      console.log("EXPECTED EVENTS", JSON.stringify(expectedEvents));
      assert.equal(events.length, expectedEvents.length);
      for (let i = 0; i < events.length; ++i) {
        // Ignore the timestamp field
        assert.equal(events[i].event, expectedEvents[i]);
        // Micropilot sticks an eventstoreid field on every record
        assert.equal(events[i].eventstoreid, i + 1);
      }
      deferred.resolve(true);
      return deferred.promise;
    });//.then(monitor.clear);
}

/**
 * Returns a promise whose resolution is an event and a message.
 * @param aURL same as previously mentioned functions
 * @param aDoNav a boolean indicating the page should be navigated if true
 * @return promise resolving to the event and a message
 */
function promisePanel(assert, aURL, aDoNav) {
  let win = winUtils.getMostRecentBrowserWindow();
  let deferred = defer();
  let consentPanelShownListener = null;
  consentPanelShownListener = function(event) {
    assert.pass("Got consent panel");
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
function promisePage(assert, aURL, aDoNav) {
  console.log("promised page");
  let win = winUtils.getMostRecentBrowserWindow();
  let currentBrowser = win.gBrowser.selectedBrowser;

  let deferred = defer();
  // We resolve the promise with the event and a message
  let loadListener = null;
  loadListener = function(event) {
    if (event.target.documentURI == aURL) {
      console.log("Got promised url", aURL);
      assert.pass("Got promised url", aURL);
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

function postContinuation(response) {
  let deferred = defer();
  response.event.detail.postMessage("continue");
  deferred.resolve(response);
  return deferred.promise;
}

/**
 * Given a url and a continuation to call upon completion, this function loads
 * up the url and expects that the consent panel will be shown.
 * @param aURL a string representing a url to load
 */
function testExpectConsentPanelThenWhitelist(assert) {
  console.log("testExpectConsentPanelThenWhitelist");
  return promisePanel(assert, kUrl, true).
    then(function(response) {
      assert.equal(response.message, "panel shown");
      return postContinuation(response);
    }).
    then(function() { return promisePage(assert, kUrl, false); }).
    then(function() { return testMonitor(assert,
                     [kEvents.BLUSHY_SITE,
                      kEvents.OPEN_NORMAL,
                      kEvents.WHITELISTED_SITE]);
    });
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
function testExpectNoConsentPanelWhitelisted(assert) {
  console.log("testExpectConsentPanelThenWhitelist");
  return promisePage(assert, kUrl, true).
    then(function() { return testMonitor(assert,
                     [kEvents.BLUSHY_SITE,
                      kEvents.OPEN_NORMAL,
                      kEvents.WHITELISTED_SITE,
                      kEvents.WHITELISTED_SITE]);
  });
}

/**
 * The third time we load localhost:4444, we don't expect to see a consent
 * panel, because we've removed it from the blushlist entirely.
 */
function testExpectNoConsentPanelNotOnBlushlist(assert) {
  let key = bpUtil.getKeyForHost("localhost");
  delete ss.storage.blushlist.map[key];
  // We have to clear these together to keep things consistent.
  delete ss.storage.whitelistedDomains[key];
  delete ss.storage.whitelistedCategories["testing"];
  assert.equal(bpCategorizer.getCategoryForHost("localhost"),
                      null,
                      "'localhost' should not be on the blushlist");
  assert.ok(!ss.storage.whitelistedDomains["localhost"],
                   "'localhost' should not be on the domain whitelist");
  // No new events
  return promisePage(assert, kUrl, true).
    then(function() { return testMonitor(assert,
                     [kEvents.BLUSHY_SITE,
                      kEvents.OPEN_NORMAL,
                      kEvents.WHITELISTED_SITE,
                      kEvents.WHITELISTED_SITE]);
  });
}

function promiseVisitedUri(assert, aURIString) {
  let deferred = defer();
  let uri = NetUtil.newURI(aURIString, null, null);
  let asyncHistory = Cc["@mozilla.org/browser/history;1"]
                       .getService(Ci.mozIAsyncHistory);
  asyncHistory.isURIVisited(uri, function(aURI, aVisitedStatus) {
    assert.equal(uri, aURI);
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
    event.detail.postMessage("blush");
    if (aForget) {
      event.detail.postMessage("forget");
    }
    deferred.resolve();
  };
  win.addEventListener("BlushPanelShown", blushPanelShownListener);
  return deferred.promise;
}

function testBlushThis(assert) {
  console.log("testBlushThis");
  let win = winUtils.getMostRecentBrowserWindow();

  return promisePage(assert, kUrl, true).
    then(function() { return promiseBlushButton(win); }).
    then(function() { return promiseBlushHidden(win, false); }).
    then(function() { return promiseVisitedUri(assert, kUrl); }).
    then(function(aVisited) {
      assert.ok(aVisited);
      return promisePanel(assert, kUrl, true); }).
    then(function(response) {
      response.event.detail.hide();
      return testMonitor(assert, 
        [kEvents.BLUSHY_SITE,
         kEvents.OPEN_NORMAL,
         kEvents.WHITELISTED_SITE,
         kEvents.WHITELISTED_SITE,
         kEvents.ADD_BLUSHLIST,
         kEvents.BLUSHY_SITE]);
    });
}

function testBlushAndForgetThis(assert) {
  let key = bpUtil.getKeyForHost("localhost");
  delete ss.storage.blushlist.map[key];
  let promiseBlushHidden = function() {
    let deferred = defer();
    let blushPanelHiddenListener = function(event) {
      win.removeEventListener("BlushPanelHidden", blushPanelHiddenListener);
      assert.equal(bpCategorizer.getCategoryForHost("localhost"),
                   "user",
                   "check using Blush This on 'localhost' works");
      deferred.resolve(true);
    }
    win.addEventListener("BlushPanelHidden", blushPanelHiddenListener);
    return deferred.promise;
  }


  let promiseBlushButton = function() {
    let deferred = defer();
    bpUI.blushButton.panel.show();
    let blushPanelShownListener = function(event) {
      console.log("pushing blush and forget button");
      win.removeEventListener("BlushPanelShown", blushPanelShownListener);
      event.detail.postMessage("blush");
      event.detail.postMessage("forget");
      deferred.resolve(true);
    };
    win.addEventListener("BlushPanelShown", blushPanelShownListener);
    return deferred.promise;
  }

  console.log("testBlushAndForgetThis");
  return promisePage(assert, kUrl, true);/*.
    then(promiseBlushButton).
    then(promiseBlushHidden).
    then(function() { console.log("here");return promiseVisitedUri(assert, kUrl); }).
    then(function(aVisited) {
      assert.ok(!aVisited);
      return promisePanel(assert, kUrl, true);
    }).
    then(function(response) {
      response.event.detail.hide();
      return testMonitor(assert, 
        [kEvents.BLUSHY_SITE,
         kEvents.OPEN_NORMAL,
         kEvents.WHITELISTED_SITE,
         kEvents.WHITELISTED_SITE,
         kEvents.ADD_BLUSHLIST,
         kEvents.BLUSHY_SITE,
         kEvents.ADD_BLUSHLIST,
         kEvents.BLUSHY_SITE]);
    });
*/
}

// In case the function name isn't clear: this test checks that we properly
// remove a domain from the blushlist if the user used the "Blush This!"
// button on it.
function testUnblushUserBlushedSite() {
  console.log("testUnblushUserBlushedSite");
  gAssertObject.equal(bpCategorizer.getCategoryForHost("localhost"),
                      "user",
                      "localhost should be in category 'user'");
  expectConsentPanel("http://localhost:4444/",
    function(aSuccess, aEvent) {
      if (aSuccess) {
        let panel = aEvent.detail;
        expectNoConsentPanelNoNav("http://localhost:4444/",
          function() {
            gAssertObject.ok(!bpCategorizer.getCategoryForHost("localhost"),
                             "localhost should have no category now");
            gAssertObject.ok(!ss.storage.whitelistedCategories["user"],
                             "the 'user' category should never be whitelisted");
            testMonitor([kEvents.BLUSHY_SITE,
                         kEvents.OPEN_NORMAL,
                         kEvents.WHITELISTED_SITE,
                         kEvents.WHITELISTED_SITE,
                         kEvents.ADD_BLUSHLIST,
                         kEvents.BLUSHY_SITE,
                         kEvents.FORGET_SITE,
                         kEvents.ADD_BLUSHLIST,
                         kEvents.BLUSHY_SITE,
                         kEvents.BLUSHY_SITE,
                         kEvents.OPEN_NORMAL,
                         kEvents.WHITELISTED_SITE]);
            runNextTest();
          }
        );
        panel.postMessage("continue");
      } else {
        runNextTest();
      }
    }
  );
}

function testWhitelistCategoryAfter3DomainsWhitelisted() {
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
  gAssertObject.ok(!bpCategorizer.isHostWhitelisted("thirdsite.com"));
  // only 2 sites in the "testing" category have been whitelisted, so we
  // expect a consent panel here
  expectConsentPanel("http://localhost:4444/",
    function(aSuccess, aEvent) {
      if (aSuccess) {
        let panel = aEvent.detail;
        expectNoConsentPanelNoNav("http://localhost:4444/",
          function() {
            gAssertObject.ok(bpCategorizer.isHostWhitelisted("thirdsite.com"));
            testMonitor([kEvents.BLUSHY_SITE,
                         kEvents.OPEN_NORMAL,
                         kEvents.WHITELISTED_SITE,
                         kEvents.WHITELISTED_SITE,
                         kEvents.ADD_BLUSHLIST,
                         kEvents.BLUSHY_SITE,
                         kEvents.FORGET_SITE,
                         kEvents.ADD_BLUSHLIST,
                         kEvents.BLUSHY_SITE,
                         kEvents.BLUSHY_SITE,
                         kEvents.OPEN_NORMAL,
                         kEvents.WHITELISTED_SITE]);
			 // We should have an event for whitelisted categories
	    runNextTest();
          }
        );
        // When we post this message, we whitelist the third site in the
        // category "testing". At that point, whitelistme.com (and anything
        // else in that category) should be considered whitelisted.
        panel.postMessage("continue");
      } else {
        runNextTest();
      }
    }
  );
}

exports["test main async"] = function(assert, done) {
  console.log("test main async");
  let key = bpUtil.getKeyForHost("localhost");
  assert.pass("async Unit test running!");
  ss.storage.blushlist.map[key] = "testing";
  assert.equal(bpCategorizer.getCategoryForHost("localhost"),
               "testing",
               "sanity check that putting 'localhost' on the blushlist works");
  let httpServer = new nsHttpServer();
  httpServer.start(4444);
    //then(function() { return testBlushAndForgetThis(assert); }).
  testExpectConsentPanelThenWhitelist(assert).
    then(function() { return testExpectNoConsentPanelWhitelisted(assert); }).
    then(function() { return testExpectNoConsentPanelNotOnBlushlist(assert); }).
    then(function() { return testBlushThis(assert); }).
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
/*
             testUnblushUserBlushedSite,
             testWhitelistCategoryAfter3DomainsWhitelisted
*/
};

/**
 * We have to call main's main() to load up blushproof. After that, we
 * run our tests.
 */
main.main();
require("sdk/test").run(exports);
