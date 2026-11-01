// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Lantern } from "@jolly-pixel/lantern";
import { Preferences } from "@jolly-pixel/preferences";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  CAMERA_PREFERENCES,
  provideTourKeys
} from "#src/index.ts";

function cameraTourKeys(
  preferences: Preferences,
  layout: ReadonlyMap<string, string> | null = null
): Lantern {
  const lantern = new Lantern({ storage: new MemoryStorageAdapter() });
  provideTourKeys({
    lantern,
    preferences,
    scope: CAMERA_PREFERENCES,
    layout: { layout }
  });

  return lantern;
}

describe("provideTourKeys", () => {
  test("labels the keys the user bound, as their keyboard prints them", () => {
    const preferences = new Preferences({
      overrides: [["camera", { forward: ["KeyW"] }]]
    });
    const lantern = cameraTourKeys(preferences, new Map([["KeyW", "z"]]));

    assert.deepEqual(lantern.keys.labels("camera.forward"), ["Z"]);

    preferences.assign(CAMERA_PREFERENCES, "forward", ["KeyE"]);

    assert.deepEqual(lantern.keys.labels("camera.forward"), ["E"]);
  });

  test("names a two-sided modifier once and an unbound action with no label", () => {
    const preferences = new Preferences({
      overrides: [["camera", { up: [] }]]
    });
    const lantern = cameraTourKeys(preferences);

    assert.deepEqual(lantern.keys.labels("camera.down"), ["Shift"]);
    assert.deepEqual(lantern.keys.labels("camera.up"), []);
  });

  test("knows only the binding fields of the scope", () => {
    const lantern = cameraTourKeys(new Preferences());

    assert.equal(lantern.keys.labels("camera.flySpeed"), undefined);
  });
});
