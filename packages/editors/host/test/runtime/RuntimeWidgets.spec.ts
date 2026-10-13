// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { RuntimeWidgets } from "#src/runtime/RuntimeWidgets.ts";
import { createWidgetHost } from "../helpers/runtime/widgetHost.ts";

// CONSTANTS
const kKey = "jolly-pixel:runtime-widgets";

describe("RuntimeWidgets", () => {
  test("restores the visibility a previous page stored", () => {
    const storage = new MemoryStorageAdapter();
    const widgets = new RuntimeWidgets(createWidgetHost(), storage);
    widgets.show("stats", false);
    widgets.show("metrics", true);

    const reloaded = createWidgetHost();
    new RuntimeWidgets(reloaded, storage).restore();

    assert.equal(reloaded.statsHud?.hidden, true);
    assert.equal(reloaded.metrics.panel?.hidden, false);
    assert.equal(reloaded.viewHelper?.hidden, false);
  });

  test("starts a widget hidden from its stored visibility, else the fallback", () => {
    const storage = new MemoryStorageAdapter();
    new RuntimeWidgets(createWidgetHost(), storage).show("metrics", true);
    const widgets = new RuntimeWidgets(createWidgetHost(), storage);

    assert.equal(widgets.startsHidden("metrics", true), false);
    assert.equal(widgets.startsHidden("stats", true), true);
    assert.equal(widgets.startsHidden("stats", false), false);
  });

  test("keeps the defaults when the stored value is not usable", () => {
    const storage = new MemoryStorageAdapter();
    storage.set(kKey, JSON.stringify({
      stats: "off",
      metrics: true
    }));
    const host = createWidgetHost();
    new RuntimeWidgets(host, storage).restore();

    assert.equal(host.statsHud?.hidden, false);
    assert.equal(host.metrics.panel?.hidden, false);

    storage.set(kKey, "{not json");
    const fresh = createWidgetHost();
    new RuntimeWidgets(fresh, storage).restore();

    assert.equal(fresh.metrics.panel?.hidden, true);
  });
});
