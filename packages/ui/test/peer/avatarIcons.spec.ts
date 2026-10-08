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
  defaultAvatarIcon
} from "../../src/peer/avatarIcons.ts";
import { hasIcon } from "../../src/icon/registry.ts";

function peerIds(
  count: number
): string[] {
  return Array.from({ length: count }, (_, index) => `peer-${index}`);
}

describe("defaultAvatarIcon", () => {
  test("names a registered icon", () => {
    for (const peerId of peerIds(50)) {
      assert.ok(hasIcon(defaultAvatarIcon(peerId)), peerId);
    }
  });

  test("gives a peer id the same avatar every time", () => {
    assert.equal(defaultAvatarIcon("peer-42"), defaultAvatarIcon("peer-42"));
  });

  test("uses every default avatar", () => {
    const icons = new Set(peerIds(500).map(defaultAvatarIcon));

    assert.equal(icons.size, DEFAULT_AVATARS.length);
  });

  test("pairs every avatar with every peer color", () => {
    const pairs = new Set(peerIds(2_000).map(
      (peerId) => `${defaultAvatarIcon(peerId)} ${colorFromKey(peerId)}`
    ));

    assert.equal(
      pairs.size,
      DEFAULT_AVATARS.length * defaultPaletteColors().length
    );
  });
});
