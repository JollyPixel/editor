// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ASSET_ROOM_MAX_PARTS_PER_MESSAGE,
  partRequests
} from "#src/index.ts";

describe("partRequests", () => {
  test("splits part IDs into messages the room accepts", () => {
    const partIds = Array.from(
      { length: ASSET_ROOM_MAX_PARTS_PER_MESSAGE + 1 },
      (_, index) => `p${index}`
    );

    const requests = partRequests("subscribe-parts", partIds);

    assert.deepEqual(
      requests.map(({ action, parts }) => [action, parts.length]),
      [
        ["subscribe-parts", ASSET_ROOM_MAX_PARTS_PER_MESSAGE],
        ["subscribe-parts", 1]
      ]
    );
    assert.deepEqual(requests.flatMap(({ parts }) => parts), partIds);
  });
});
