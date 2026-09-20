// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { mountStandalone } from "#src/editor/mountStandalone.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";

describe("mountStandalone", () => {
  test("rejects before any session when no launch source names a target", async() => {
    let mounted = false;
    const editor = {
      accepts: "voxelmap",
      identity: { title: "Join" },
      kinds: [],
      mount: () => {
        mounted = true;

        return Promise.resolve({ dispose: () => void 0 });
      }
    };

    await assert.rejects(
      mountStandalone(editor, {
        sources: [{ read: () => Promise.resolve(undefined) }]
      }),
      LaunchNotFoundError
    );
    assert.equal(mounted, false);
  });
});
