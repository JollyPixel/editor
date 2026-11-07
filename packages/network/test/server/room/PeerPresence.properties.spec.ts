// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { PeerPresence } from "#src/server/room/PeerPresence.ts";
import { encodedLength } from "#src/protocol/frame/Frame.ts";
import {
  arbitraryRecord,
  jsonPayload
} from "../../helpers/arbitraries/json.ts";

// CONSTANTS
const kPresencePatch = arbitraryRecord(
  fc.oneof(jsonPayload, fc.uint8Array({ maxLength: 16 }))
);

test("PeerPresence length is the encoded length of the merged presence after any patches", () => {
  fc.assert(
    fc.property(
      fc.array(kPresencePatch, { maxLength: 6 }),
      (patches) => {
        const presence = patches.reduce(
          (merged, patch) => merged.patched(patch),
          PeerPresence.EMPTY
        );

        assert.strictEqual(
          presence.length,
          encodedLength(presence.values)
        );
      }
    )
  );
});
