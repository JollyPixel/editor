// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  MemoryPickerPreferences,
  PickerPreferences
} from "../../src/color/PickerPreferences.ts";

function countingHost() {
  const host = {
    updates: 0,
    requestUpdate() {
      host.updates++;
    }
  };

  return host;
}

describe("Color.PickerPreferences", () => {
  test("keeps its own values until a source is followed", () => {
    const preferences = new PickerPreferences();
    const host = countingHost();
    preferences.attach(host);

    preferences.update({ space: "okhsv" });

    assert.equal(preferences.values.space, "okhsv");
    assert.equal(host.updates, 1);
  });

  test("routes reads and writes to the followed source alone, until released", () => {
    const preferences = new PickerPreferences();
    const host = countingHost();
    const source = new MemoryPickerPreferences();
    preferences.attach(host);

    const release = preferences.follow(source);
    preferences.update({ selector: "wheel" });
    source.update({ harmony: "triadic" });

    assert.equal(source.values().selector, "wheel");
    assert.equal(preferences.values.harmony, "triadic");
    assert.equal(host.updates, 3);

    release();
    source.update({ discrete: true });

    assert.equal(preferences.values.selector, "square");
    assert.equal(host.updates, 4);
  });
});
