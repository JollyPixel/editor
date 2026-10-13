// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  colorFromKey,
  defaultPaletteColors
} from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  DEFAULT_AVATARS,
  pickDefaultAvatar
} from "../../src/peer/defaultAvatars.ts";

function peerIds(
  count: number
): string[] {
  return Array.from({ length: count }, (_, index) => `peer-${index}`);
}

describe("pickDefaultAvatar", () => {
  test("gives a peer id the same avatar every time", () => {
    assert.equal(pickDefaultAvatar("peer-42"), pickDefaultAvatar("peer-42"));
  });

  test("uses every default avatar", () => {
    const avatars = new Set(peerIds(500).map(pickDefaultAvatar));

    assert.equal(avatars.size, DEFAULT_AVATARS.length);
  });

  test("pairs every avatar with every peer color", () => {
    const pairs = new Set(peerIds(2_000).map(
      (peerId) => `${pickDefaultAvatar(peerId).name} ${colorFromKey(peerId)}`
    ));

    assert.equal(
      pairs.size,
      DEFAULT_AVATARS.length * defaultPaletteColors().length
    );
  });
});
