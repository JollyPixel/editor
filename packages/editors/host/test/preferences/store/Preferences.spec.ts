// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Preferences,
  definePreferences,
  type PreferenceChange
} from "#src/preferences/index.ts";

// CONSTANTS
const kCamera = definePreferences({
  name: "camera",
  label: "Camera",
  fields: {
    invertY: {
      type: "boolean",
      label: "Invert Y",
      default: false
    },
    speed: {
      type: "range",
      label: "Speed",
      min: 0.25,
      max: 4,
      default: 1
    }
  }
});

describe("Preferences", () => {
  test("a view shares values and writes, and its disposal drops only its own listeners", () => {
    const changes: PreferenceChange[] = [];
    const preferences = new Preferences({
      write: (change) => changes.push(change)
    });
    const view = preferences.view();
    const seen: string[] = [];
    preferences.watch(kCamera, (values) => seen.push(`page ${values.speed}`));
    view.watch(kCamera, (values) => seen.push(`view ${values.speed}`));

    view.assign(kCamera, "speed", 2);
    view.dispose();
    view.watch(kCamera, (values) => seen.push(`late ${values.speed}`));
    preferences.assign(kCamera, "speed", 3);

    assert.deepEqual(seen, ["page 2", "view 2", "page 3"]);
    assert.equal(view.values(kCamera).speed, 3);
    assert.equal(changes.length, 2);
  });

  test("disposing a view keeps the same listener subscribed through another view", () => {
    const preferences = new Preferences();
    const first = preferences.view();
    const second = preferences.view();
    const scopes: string[] = [];
    function listener(
      scope: string
    ): void {
      scopes.push(scope);
    }
    first.subscribe(listener);
    second.subscribe(listener);

    first.dispose();
    preferences.assign(kCamera, "speed", 2);

    assert.deepEqual(scopes, ["camera"]);
  });

  test("writes and announces an assigned value", () => {
    const changes: PreferenceChange[] = [];
    const preferences = new Preferences({
      write: (change) => changes.push(change)
    });
    const seen: boolean[] = [];
    preferences.watch(kCamera, (values) => seen.push(values.invertY));

    preferences.assign(kCamera, "invertY", true);
    preferences.assign(kCamera, "invertY", true);

    assert.deepEqual(changes, [
      {
        scope: "camera",
        patch: { invertY: true },
        overrides: { invertY: true }
      }
    ]);
    assert.deepEqual(seen, [true]);
  });

  test("update writes and announces a patch of several fields once", () => {
    const changes: PreferenceChange[] = [];
    const preferences = new Preferences({
      write: (change) => changes.push(change)
    });
    let notified = 0;
    preferences.watch(kCamera, () => notified++);

    preferences.update(kCamera, {
      invertY: true,
      speed: 2
    });

    assert.deepEqual(changes, [
      {
        scope: "camera",
        patch: { invertY: true, speed: 2 },
        overrides: { invertY: true, speed: 2 }
      }
    ]);
    assert.equal(notified, 1);
  });

  test("announces received overrides without writing them", () => {
    const changes: PreferenceChange[] = [];
    const preferences = new Preferences({
      write: (change) => changes.push(change)
    });
    const seen: number[] = [];
    preferences.watch(kCamera, (values) => seen.push(values.speed));

    preferences.receive("camera", { speed: 2 });

    assert.deepEqual(seen, [2]);
    assert.deepEqual(changes, []);
  });

  test("reset writes every field back to its default in one change", () => {
    const changes: PreferenceChange[] = [];
    const preferences = new Preferences({
      overrides: [["camera", { invertY: true, speed: 2 }]],
      write: (change) => changes.push(change)
    });

    preferences.reset(kCamera);

    assert.deepEqual(preferences.values(kCamera), kCamera.defaults);
    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0].overrides, {});
    assert.deepEqual([...preferences], []);
  });
});
