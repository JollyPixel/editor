// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { PeerPresence } from "#src/server/room/PeerPresence.ts";
import { metadata } from "../../helpers/arbitraries/json.ts";

test("PeerPresence length is the JSON length of the merged presence after any patches", () => {
  fc.assert(
    fc.property(
      fc.array(metadata, { maxLength: 6 }),
      (patches) => {
        const presence = patches.reduce(
          (merged, patch) => merged.patched(patch),
          PeerPresence.EMPTY
        );

        assert.strictEqual(
          presence.length,
          JSON.stringify(presence.values).length
        );
      }
    )
  );
});
