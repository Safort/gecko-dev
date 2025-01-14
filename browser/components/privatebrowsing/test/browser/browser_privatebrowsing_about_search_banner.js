/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This test makes sure that about:privatebrowsing correctly shows the search
// banner.

const { AboutPrivateBrowsingHandler } = ChromeUtils.import(
  "resource:///modules/aboutpages/AboutPrivateBrowsingHandler.jsm"
);
const { RemotePages } = ChromeUtils.import(
  "resource://gre/modules/remotepagemanager/RemotePageManagerParent.jsm"
);

const PREF_UI_ENABLED = "browser.search.separatePrivateDefault.ui.enabled";
const PREF_BANNER_SHOWN =
  "browser.search.separatePrivateDefault.ui.banner.shown";
const MAX_SEARCH_BANNER_SHOW_COUNT = 5;

add_task(async function setup() {
  SpecialPowers.pushPrefEnv({
    set: [
      [PREF_UI_ENABLED, false],
      [PREF_BANNER_SHOWN, 0],
      ["browser.urlbar.disableExtendForTests", true],
    ],
  });

  AboutPrivateBrowsingHandler._searchBannerShownThisSession = false;
});

add_task(async function test_not_shown_if_pref_off() {
  const { win, tab } = await openAboutPrivateBrowsing();

  await ContentTask.spawn(tab, null, async function() {
    await ContentTaskUtils.waitForCondition(
      () =>
        content.document.documentElement.hasAttribute(
          "SearchBannerInitialized"
        ),
      "Should have initialized"
    );
    ok(
      content.document.getElementById("search-banner").hasAttribute("hidden"),
      "should be hiding the in-content search banner"
    );
  });

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_show_banner_first() {
  SpecialPowers.pushPrefEnv({
    set: [[PREF_UI_ENABLED, true]],
  });

  let prefChanged = TestUtils.waitForPrefChange(PREF_BANNER_SHOWN);

  const { win, tab } = await openAboutPrivateBrowsing();

  Assert.equal(
    await prefChanged,
    1,
    "Should have incremented the amount of times shown."
  );

  await ContentTask.spawn(tab, null, async function() {
    await ContentTaskUtils.waitForCondition(
      () =>
        content.document.documentElement.hasAttribute(
          "SearchBannerInitialized"
        ),
      "Should have initialized"
    );

    ok(
      !content.document.getElementById("search-banner").hasAttribute("hidden"),
      "should be showing the in-content search banner"
    );
  });

  await BrowserTestUtils.closeWindow(win);

  const { win: win1, tab: tab1 } = await openAboutPrivateBrowsing();

  await ContentTask.spawn(tab1, null, async function() {
    await ContentTaskUtils.waitForCondition(
      () =>
        content.document.documentElement.hasAttribute(
          "SearchBannerInitialized"
        ),
      "Should have initialized"
    );

    ok(
      content.document.getElementById("search-banner").hasAttribute("hidden"),
      "should not be showing the banner in a second window."
    );
  });

  await BrowserTestUtils.closeWindow(win1);

  Assert.equal(
    Services.prefs.getIntPref(PREF_BANNER_SHOWN, -1),
    1,
    "Should not have changed the preference further"
  );
});

add_task(async function test_show_banner_max_times() {
  // We've already shown the UI once, so show it a few more times.
  for (let i = 1; i < MAX_SEARCH_BANNER_SHOW_COUNT; i++) {
    // To avoid having to restart Firefox and slow down tests, we manually reset
    // the session pref.
    AboutPrivateBrowsingHandler._searchBannerShownThisSession = false;

    let prefChanged = TestUtils.waitForPrefChange(PREF_BANNER_SHOWN);
    const { win, tab } = await openAboutPrivateBrowsing();

    Assert.equal(
      await prefChanged,
      i + 1,
      "Should have incremented the amount of times shown."
    );

    await ContentTask.spawn(tab, null, async function() {
      await ContentTaskUtils.waitForCondition(
        () =>
          content.document.documentElement.hasAttribute(
            "SearchBannerInitialized"
          ),
        "Should have initialized"
      );

      ok(
        !content.document
          .getElementById("search-banner")
          .hasAttribute("hidden"),
        "Should be showing the banner again"
      );
    });

    await BrowserTestUtils.closeWindow(win);
  }

  // Final time!

  AboutPrivateBrowsingHandler._searchBannerShownThisSession = false;

  const { win, tab } = await openAboutPrivateBrowsing();

  await ContentTask.spawn(tab, null, async function() {
    await ContentTaskUtils.waitForCondition(
      () =>
        content.document.documentElement.hasAttribute(
          "SearchBannerInitialized"
        ),
      "Should have initialized"
    );

    ok(
      content.document.getElementById("search-banner").hasAttribute("hidden"),
      "should not be showing the banner again"
    );
  });

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_show_banner_close_no_more() {
  SpecialPowers.pushPrefEnv({
    set: [[PREF_BANNER_SHOWN, 0]],
  });

  AboutPrivateBrowsingHandler._searchBannerShownThisSession = false;

  const { win, tab } = await openAboutPrivateBrowsing();

  await ContentTask.spawn(tab, null, async function() {
    await ContentTaskUtils.waitForCondition(
      () =>
        content.document.documentElement.hasAttribute(
          "SearchBannerInitialized"
        ),
      "Should have initialized"
    );

    ok(
      !content.document.getElementById("search-banner").hasAttribute("hidden"),
      "should be showing the banner again before closing"
    );

    content.document.getElementById("search-banner-close-button").click();

    await ContentTaskUtils.waitForCondition(
      () =>
        ContentTaskUtils.is_hidden(
          content.document.getElementById("search-banner")
        ),
      "should have closed the in-content search banner after clicking close"
    );
  });

  await BrowserTestUtils.closeWindow(win);

  Assert.equal(
    Services.prefs.getIntPref(PREF_BANNER_SHOWN, -1),
    MAX_SEARCH_BANNER_SHOW_COUNT,
    "Should have set the shown preference to the maximum"
  );
});

add_task(async function test_show_banner_open_preferences_and_no_more() {
  SpecialPowers.pushPrefEnv({
    set: [[PREF_BANNER_SHOWN, 0]],
  });

  AboutPrivateBrowsingHandler._searchBannerShownThisSession = false;

  const { win, tab } = await openAboutPrivateBrowsing();

  // This is "borrowed" from the preferences test code, as waiting for the
  // full preferences to load helps avoid leaking a window.
  const finalPaneEvent = Services.prefs.getBoolPref(
    "identity.fxaccounts.enabled"
  )
    ? "sync-pane-loaded"
    : "privacy-pane-loaded";
  let finalPrefPaneLoaded = TestUtils.topicObserved(finalPaneEvent, () => true);
  const waitForInitialized = new Promise(resolve => {
    tab.addEventListener(
      "Initialized",
      () => {
        tab.contentWindow.addEventListener(
          "load",
          async function() {
            await finalPrefPaneLoaded;
            resolve();
          },
          { once: true }
        );
      },
      { capture: true, once: true }
    );
  });

  await ContentTask.spawn(tab, null, async function() {
    await ContentTaskUtils.waitForCondition(
      () =>
        content.document.documentElement.hasAttribute(
          "SearchBannerInitialized"
        ),
      "Should have initialized"
    );

    ok(
      !content.document.getElementById("search-banner").hasAttribute("hidden"),
      "should be showing the banner again before opening prefs"
    );

    content.document.getElementById("open-search-options-link").click();
  });

  info("Waiting for preference window load");
  await waitForInitialized;

  await BrowserTestUtils.closeWindow(win);

  Assert.equal(
    Services.prefs.getIntPref(PREF_BANNER_SHOWN, -1),
    MAX_SEARCH_BANNER_SHOW_COUNT,
    "Should have set the shown preference to the maximum"
  );
});
