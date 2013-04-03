let main = require("main");
let bpUtil = require("bpUtil");
let bpUI = require("bpUI");
let bpCategorizer = require("bpCategorizer");
let ss = require("simple-storage");
let winUtils = require("sdk/window/utils");
let tabs = require("sdk/tabs");
let { nsHttpServer } = require("sdk/test/httpd");
let { Cc, Ci, Cu } = require("chrome");

Cu.import("resource://gre/modules/NetUtil.jsm");

let gHttpServer = null;
// This gets set in the main async test function so we can signal
// the test harness that we're done asynchronously.
let gDoneFunction = null;
// This gets set in the main async test function so we can note passes
// and failures to the test harness asynchronously.
let gAssertObject = null;
let gTests = null;

function runNextTest() {
  let nextTest = gTests.shift();
  if (nextTest) {
    nextTest();
  } else {
    finishTest();
  }
}

/**
 * Given a url and a continuation to call upon completion, this function loads
 * up the url and expects that the consent panel will be shown.
 * @param aURL a string representing a url to load
 * @param aContinuation a function to call upon completion. The function takes
 *        two arguments: a boolean indicating success if true, and the
 *        event spawned by either the page load or consent panel opening.
 */
function expectConsentPanel(aURL, aContinuation) {
  expectOrNotPanelCommon(aURL, aContinuation, true, true);
}

/**
 * Same as expectConsentPanel, except it is expected that the page load
 * succeeds and that no consent panel is shown.
 */
function expectNoConsentPanel(aURL, aContinuation) {
  expectOrNotPanelCommon(aURL, aContinuation, false, true);
}

/**
 * Same as expectNoConsentPanel, except it only sets up the appropriate
 * listeners - no navigation is done. The caller of this function must
 * perform the navigation itself (e.g. by clicking "open anyway" in a
 * previously shown consent panel).
 */
function expectNoConsentPanelNoNav(aURL, aContinuation) {
  expectOrNotPanelCommon(aURL, aContinuation, false, false);
}

/**
 * Common function for expectConsentPanel, expectNoConsentPanel, and
 * expectNoConsentPanelNoNav. Probably shouldn't be called directly (use
 * one of the aforementioned functions).
 * @param aURL same as previously mentioned functions
 * @param aContinuation same as previously mentioned functions
 * @param aExpectPanel a boolean indicating the panel is expected if true
 * @param aDoNav a boolean indicating the page should be navigated if true
 */
function expectOrNotPanelCommon(aURL, aContinuation, aExpectPanel, aDoNav) {
  let win = winUtils.getMostRecentBrowserWindow();
  let currentBrowser = win.gBrowser.selectedBrowser;

  let loadListener = null;
  let consentPanelShownListener = null;
  let current = true;

  loadListener = function(event) {
    if (event.target.documentURI == aURL) {
      currentBrowser.removeEventListener("load", loadListener);
      win.removeEventListener("ConsentPanelShown", consentPanelShownListener);
      if (!current) {
        return;
      }
      if (aExpectPanel) {
        gAssertObject.fail("got page load when we shouldn't have");
      } else {
        gAssertObject.pass("got page load when it was okay to");
      }
      current = false;
      aContinuation(!aExpectPanel, event);
    }
  };

  consentPanelShownListener = function(event) {
    currentBrowser.removeEventListener("load", loadListener);
    win.removeEventListener("ConsentPanelShown", consentPanelShownListener);
    if (!current) {
      return;
    }
    if (aExpectPanel) {
      gAssertObject.pass("panel shown when we were expecting it");
    } else {
      gAssertObject.fail("panel shown when we weren't expecting it");
    }
    current = false;
    aContinuation(aExpectPanel, event);
  };

  currentBrowser.addEventListener("load", loadListener, true);
  win.addEventListener("ConsentPanelShown", consentPanelShownListener);

  // Using 'currentBrowser.contentWindow.location = aURL;'
  // somehow bypasses our content policy. I'm guessing it has something to do
  // with chrome privileges, but I'm too annoyed with it to figure it out now.
  if (aDoNav) {
    tabs[0].url = aURL;
  }
}

/**
 * Given a string representing a URI and a callback to call upon completion,
 * this asks the async history service if the URI has been visited. The
 * callback takes a single boolean that is true if the URI has been visited.
 * @param aURIString a string representing a URI
 * @param aCallback a callback to call upon completion
 */
function asyncHaveVisitedURI(aURIString, aCallback) {
  let uri = NetUtil.newURI(aURIString, null, null);
  let asyncHistory = Cc["@mozilla.org/browser/history;1"]
                       .getService(Ci.mozIAsyncHistory);
  asyncHistory.isURIVisited(uri, function(aURI, aVisitedStatus) {
    gAssertObject.equal(aURIString, aURI.spec,
      "sanity check: we got back information about the URI we asked about");
    aCallback(aVisitedStatus);
  });
}

/**
 * The first time we load localhost:4444, we expect to see a consent
 * panel, because it's on the blushlist (we added it for this test under
 * the category "testing").
 */
function testExpectConsentPanel() {
  expectConsentPanel("http://localhost:4444/",
    function(aSuccess, aEvent) {
      if (aSuccess) {
        let panel = aEvent.detail;
        expectNoConsentPanelNoNav("http://localhost:4444/", runNextTest);
        panel.postMessage("continue");
      } else {
        runNextTest();
      }
    }
  );
}

/**
 * The second time we load localhost:4444, we don't expect to see a consent
 * panel, because we whitelisted it in the previous test.
 */
function testExpectNoConsentPanelWhitelisted() {
  expectNoConsentPanel("http://localhost:4444/", runNextTest);
}

/**
 * The third time we load localhost:4444, we don't expect to see a consent
 * panel, because we've removed it from the blushlist entirely.
 */
function testExpectNoConsentPanelNotOnBlushlist() {
  let key = bpUtil.getKeyForHost("localhost");
  delete ss.storage.blushlist.map[key];
  delete ss.storage.whitelistedDomains[key];
  gAssertObject.equal(bpCategorizer.getCategoryForBlushlist("localhost"),
                      null,
                      "'localhost' should not be on the blushlist");
  gAssertObject.ok(!ss.storage.whitelistedDomains["localhost"],
                   "'localhost' should not be on the domain whitelist");
  expectNoConsentPanel("http://localhost:4444/", runNextTest);
}

function testBlushThis() {
  // The flow of this test is weird. Basically, go to the end of the function
  // and see the comment there.
  let win = winUtils.getMostRecentBrowserWindow();

  // ... and finally this.
  let blushPanelHiddenListener = function(event) {
    win.removeEventListener("BlushPanelHidden", blushPanelHiddenListener);
    gAssertObject.equal(bpCategorizer.getCategoryForBlushlist("localhost"),
                        "user",
                        "sanity check that using Blush This on 'localhost' works");
    asyncHaveVisitedURI("http://localhost:4444/", function(aVisitedStatus) {
      gAssertObject.ok(aVisitedStatus, "we didn't clear history - should have http://localhost:4444/ in history");
      expectConsentPanel("http://localhost:4444/", function(aSuccess, aEvent) {
        if (aSuccess) {
          let panel = aEvent.detail;
          panel.hide();
        }
        runNextTest();
      });
    });
  };

  // ... and then this...
  let blushPanelShownListener = function(event) {
    win.removeEventListener("BlushPanelShown", blushPanelShownListener);
    let panel = event.detail;
    win.addEventListener("BlushPanelHidden", blushPanelHiddenListener);
    panel.postMessage("blush");
  };

  // This is actually what get executed first...
  win.addEventListener("BlushPanelShown", blushPanelShownListener);
  expectNoConsentPanel("http://localhost:4444/", function() {
    bpUI.blushButton.panel.show();
  });
}

function testBlushAndForgetThis() {
  let key = bpUtil.getKeyForHost("localhost");
  delete ss.storage.blushlist.map[key];

  let win = winUtils.getMostRecentBrowserWindow();

  let blushPanelHiddenListener = function(event) {
    win.removeEventListener("BlushPanelHidden", blushPanelHiddenListener);
    asyncHaveVisitedURI("http://localhost:4444/", function(aVisitedStatus) {
      gAssertObject.ok(!aVisitedStatus, "removed site from history: shouldn't be there anymore");
      gAssertObject.equal(bpCategorizer.getCategoryForBlushlist("localhost"),
                          "user",
                          "sanity check that using Blush This on 'localhost' works");
      expectConsentPanel("http://localhost:4444/", function(aSuccess, aEvent) {
        if (aSuccess) {
          let panel = aEvent.detail;
          panel.hide();
        }
        runNextTest();
      });
    });
  };

  let blushPanelShownListener = function(event) {
    win.removeEventListener("BlushPanelShown", blushPanelShownListener);
    let panel = event.detail;
    win.addEventListener("BlushPanelHidden", blushPanelHiddenListener);
    // This is actually the opposite of the order in which data/blushthis.html
    // performs a blush-and-forget. The test has to do it in this order because
    // the blush message eventually emits the BlushPanelHidden event, which
    // is how we progress the test. Maybe we should make these consistent?
    panel.postMessage("forget");
    panel.postMessage("blush");
  };

  win.addEventListener("BlushPanelShown", blushPanelShownListener);
  expectNoConsentPanel("http://localhost:4444/", function() {
    bpUI.blushButton.panel.show();
  });
}

function finishTest() {
  main.onUnload();
  gHttpServer.stop(gDoneFunction);
}

exports["test main async"] = function(assert, done) {
  let key = bpUtil.getKeyForHost("localhost");
  assert.pass("async Unit test running!");
  ss.storage.blushlist.map[key] = "testing";
  assert.equal(bpCategorizer.getCategoryForBlushlist("localhost"),
               "testing",
               "sanity check that putting 'localhost' on the blushlist works");
  gHttpServer = new nsHttpServer();
  gHttpServer.start(4444);
  gDoneFunction = done;
  gAssertObject = assert;
  gTests = [ testExpectConsentPanel,
             testExpectNoConsentPanelWhitelisted,
             testExpectNoConsentPanelNotOnBlushlist,
             testBlushThis,
             testBlushAndForgetThis ];
  runNextTest();
};

/**
 * We have to call main's main() to load up blushproof. After that, we
 * run our tests.
 */
main.main();
require("test").run(exports);
