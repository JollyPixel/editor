// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  SHELL_MESSAGE_TYPE,
  preferencesMessage
} from "@jolly-pixel/editor.host";
import {
  Preferences,
  RUNTIME_PREFERENCES
} from "@jolly-pixel/editor.host/preferences";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PreferenceScopes } from "../../src/preferences/PreferenceScopes.ts";
import {
  frame,
  FRAME_ORIGIN,
  postFrom,
  recordPosts
} from "../helpers/editorFrames.ts";
import {
  disposeSession,
  FakeCatalog,
  MAP_RECORD,
  session
} from "../helpers/studioSession.ts";

afterEach(disposeSession);

describe("StudioSession preferences", () => {
  test("applies update-preferences and resends its overrides after a refused patch", async() => {
    const preferences = new Preferences();
    const studio = session(
      new FakeCatalog([MAP_RECORD]),
      new MemoryStorageAdapter(),
      undefined,
      {
        preferences: {
          values: preferences,
          scopes: new PreferenceScopes([RUNTIME_PREFERENCES])
        }
      }
    );
    await studio.openAsset("map-1");
    const posted = recordPosts(frame());

    for (const [scope, patch] of [
      ["runtime", { stats: false }],
      ["runtime", { stats: true, viewHelper: "off" }],
      ["missing", { stats: true }]
    ] as const) {
      postFrom(frame().contentWindow, {
        type: SHELL_MESSAGE_TYPE,
        command: "update-preferences",
        scope,
        patch
      });
    }

    const shared = [preferencesMessage("runtime", { stats: false }), FRAME_ORIGIN];
    assert.deepEqual(preferences.overrides("runtime"), { stats: false });
    assert.deepEqual(posted, [shared, shared]);
  });
});
