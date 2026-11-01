// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { RuntimeWidgets } from "#src/runtime/RuntimeWidgets.ts";
import { createWidgetHost } from "../helpers/runtime/widgetHost.ts";

describe("RuntimeWidgets", () => {
  test("shows the widgets as the preferences say and follows their changes", () => {
    const host = createWidgetHost();
    const preferences = new Preferences({
      overrides: [["runtime", { stats: false, metrics: true }]]
    });

    new RuntimeWidgets(host).follow(preferences);

    assert.equal(host.statsHud?.hidden, true);
    assert.equal(host.metrics.panel?.hidden, false);
    assert.equal(host.viewHelper?.hidden, false);

    preferences.receive("runtime", {});

    assert.equal(host.statsHud?.hidden, false);
    assert.equal(host.metrics.panel?.hidden, true);
  });

  test("keeps a widget shown or hidden from the console in the preferences", () => {
    const preferences = new Preferences();
    const widgets = new RuntimeWidgets(createWidgetHost());
    widgets.follow(preferences);

    widgets.show("stats", false);
    widgets.show("metrics", true);

    assert.deepEqual(preferences.overrides("runtime"), {
      stats: false,
      metrics: true
    });
  });

  test("starts the performance pane hidden unless a preference shows it", () => {
    const widgets = new RuntimeWidgets(createWidgetHost());

    assert.equal(widgets.startsHidden("metrics"), true);

    widgets.follow(new Preferences({
      overrides: [["runtime", { metrics: true }]]
    }));

    assert.equal(widgets.startsHidden("metrics"), false);
  });
});
