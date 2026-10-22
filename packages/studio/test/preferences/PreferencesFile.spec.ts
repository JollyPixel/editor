// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ChordConflictError,
  Preferences,
  defineKeyBindings
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import { PreferencesFile } from "../../src/preferences/PreferencesFile.ts";
import { InvalidPreferencesFileError } from "../../src/preferences/errors/InvalidPreferencesFileError.ts";
import { STUDIO_PREFERENCES } from "../../shared/studioScope.ts";

// CONSTANTS
const kKeys = defineKeyBindings({
  name: "map-keys",
  label: "Voxel map",
  defaults: {
    "tool.brush": "b",
    "tool.select": "m"
  },
  actions: {
    "tool.brush": {
      label: "Brush tool",
      group: "Tools"
    },
    "tool.select": {
      label: "Select tool",
      group: "Tools"
    }
  }
});
const kScopes = new PreferenceScopes([STUDIO_PREFERENCES, kKeys]);

function jsonFile(
  value: unknown
): Blob {
  return new Blob([JSON.stringify(value)]);
}

describe("PreferencesFile", () => {
  test("replaces each scope it carries, defaults included", async() => {
    const source = new Preferences();
    source.update(STUDIO_PREFERENCES, { theme: "dark" });
    source.update(kKeys, { "tool.brush": ["n"] });
    const target = new Preferences();
    target.update(STUDIO_PREFERENCES, { density: "compact" });
    const exported = PreferencesFile.export(source, kScopes).toDownload();

    const file = await PreferencesFile.read(exported.blob, kScopes);
    file.applyTo(target);

    assert.deepEqual(target.overrides("studio"), { theme: "dark" });
    assert.deepEqual(target.overrides("map-keys"), { "tool.brush": ["n"] });
  });

  test("drops unknown scopes and fields and leaves scopes it does not carry", async() => {
    const target = new Preferences();
    target.update(kKeys, { "tool.select": ["s"] });

    const file = await PreferencesFile.read(jsonFile({
      preferences: {
        "other-editor": { grid: false },
        studio: {
          theme: "light",
          zoom: 2,
          density: "huge"
        }
      }
    }), kScopes);
    file.applyTo(target);

    assert.equal(file.size, 1);
    assert.deepEqual(target.overrides("studio"), { theme: "light" });
    assert.deepEqual(target.overrides("map-keys"), { "tool.select": ["s"] });
  });

  test("refuses a file that is not JSON or carries conflicting shortcuts", async() => {
    await assert.rejects(
      PreferencesFile.read(new Blob(["theme=dark"]), kScopes),
      InvalidPreferencesFileError
    );
    await assert.rejects(
      PreferencesFile.read(jsonFile({ theme: "dark" }), kScopes),
      InvalidPreferencesFileError
    );
    await assert.rejects(
      PreferencesFile.read(jsonFile({
        preferences: {
          "map-keys": {
            "tool.brush": ["m"]
          }
        }
      }), kScopes),
      ChordConflictError
    );
  });
});
