let main = require("main");
let bpUtil = require("bpUtil");
let bpCategorizer = require("bpCategorizer");
let ss = require("simple-storage");
let winUtils = require("sdk/window/utils");
let tabs = require("sdk/tabs");
let { nsHttpServer } = require("sdk/test/httpd");

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
 * The first time we load localhost:4444, we expect to see a consent
 * panel, because it's on the blushlist (we added it for this test under
 * the category "testing").
 */
function testExpectConsentPanel() {
  let win = winUtils.getMostRecentBrowserWindow();
  let currentBrowser = win.gBrowser.selectedBrowser;
  let okayToLoad = false;
  currentBrowser.addEventListener("load",
    function loadListener(event) {
      if (event.target.documentURI == "http://localhost:4444/") {
        if (!okayToLoad) {
          gAssertObject.fail("got page load when shouldn't have...");
        } else {
          gAssertObject.pass("got page load when it was okay to");
          currentBrowser.removeEventListener("load", loadListener);
          runNextTest();
        }
      }
    },
    true
  );
  win.addEventListener("ConsentPanelShown",
    function consentPanelShownListener(event) {
      win.removeEventListener("ConsentPanelShown", consentPanelShownListener);
      gAssertObject.pass("panel shown");
      okayToLoad = true;
      let panel = event.detail;
      panel.postMessage("continue");
    }
  );

  // now actually do the navigation
  tabs[0].url = "http://localhost:4444/";
  // Using 'currentBrowser.contentWindow.location = "http://localhost:4444/";'
  // somehow bypasses our content policy. I'm guessing it has something to do
  // with chrome privileges, but I'm too annoyed with it to figure it out now.
}

/**
 * The second time we load localhost:4444, we don't expect to see a consent
 * panel, because we whitelisted it in the previous test.
 */
function testExpectNoConsentPanelWhitelisted() {
  let win = winUtils.getMostRecentBrowserWindow();
  let currentBrowser = win.gBrowser.selectedBrowser;
  currentBrowser.addEventListener("load",
    function loadListener(event) {
      if (event.target.documentURI == "http://localhost:4444/") {
        gAssertObject.pass("got page load when it was okay to");
        currentBrowser.removeEventListener("load", loadListener);
        runNextTest();
      }
    },
    true
  );
  win.addEventListener("ConsentPanelShown",
    function consentPanelShownListener(event) {
      win.removeEventListener("ConsentPanelShown", consentPanelShownListener);
      gAssertObject.fail("panel shown when we weren't expecting it");
      let panel = event.detail;
      panel.postMessage("continue");
    }
  );

  // now actually do the navigation
  tabs[0].url = "http://localhost:4444/";
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
  // just sharing code here
  testExpectNoConsentPanelWhitelisted();
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
             testExpectNoConsentPanelNotOnBlushlist ];
  runNextTest();
};

/**
 * We have to call main's main() to load up blushproof. After that, we
 * run our tests.
 */
main.main();
require("test").run(exports);
