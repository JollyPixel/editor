// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  LOCAL_PREFERENCES_KEY_PREFIX,
  LocalPreferences,
  definePreferences
} from "#src/index.ts";

// CONSTANTS
const kCamera = definePreferences({
  name: "camera",
  label: "Camera",
  fields: {
    invertY: {
      type: "boolean",
      label: "Invert Y",
      default: false
    }
  }
});
const kKey = `${LOCAL_PREFERENCES_KEY_PREFIX}camera`;

describe("LocalPreferences", () => {
  afterEach(() => window.localStorage.clear());

  test("stores overrides and reads them back in another page", () => {
    using first = new LocalPreferences({ storage: window.localStorage });
    first.preferences.assign(kCamera, "invertY", true);
    using second = new LocalPreferences({ storage: window.localStorage });

    assert.deepEqual(second.preferences.values(kCamera), { invertY: true });

    second.preferences.reset(kCamera);

    assert.equal(window.localStorage.getItem(kKey), null);
  });

  test("follows another tab's writes", () => {
    using local = new LocalPreferences({ storage: window.localStorage });
    const seen: boolean[] = [];
    local.preferences.watch(kCamera, (values) => seen.push(values.invertY));

    window.dispatchEvent(new window.StorageEvent("storage", {
      key: kKey,
      newValue: JSON.stringify({ invertY: true }),
      storageArea: window.localStorage
    }));

    assert.deepEqual(seen, [true]);
  });
});
