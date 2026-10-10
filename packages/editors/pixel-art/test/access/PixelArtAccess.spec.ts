// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Right } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  PixelArtAccess,
  type PixelArtGrants,
  type RightsSource
} from "../../src/access/PixelArtAccess.ts";

function rights(
  fallback: Right,
  overrides: Record<string, Right> = {}
): RightsSource {
  return {
    can: (event) => overrides[event] ?? fallback
  };
}

function grantsFor(
  access: PixelArtAccess
): PixelArtGrants {
  const { pixels, uv, uvStructure, palette, normalMap } = access;

  return { pixels, uv, uvStructure, palette, normalMap };
}

describe("PixelArtAccess", () => {
  test("grants every capability when every action is writable", () => {
    const access = PixelArtAccess.fromRights(rights("write"));

    assert.deepEqual(grantsFor(access), grantsFor(PixelArtAccess.full));
    assert.equal(access.viewOnly, false);
  });

  test("is view-only for a role that only reads, or before rights arrive", () => {
    for (const right of ["read", "void"] as const) {
      const access = PixelArtAccess.fromRights(rights(right));

      assert.deepEqual(grantsFor(access), grantsFor(PixelArtAccess.none));
      assert.equal(access.viewOnly, true);
    }
  });

  test("drops a whole capability when one of its actions is not writable", () => {
    const access = PixelArtAccess.fromRights(rights("write", {
      "texture-replaced": "read",
      "uv-region-deleted": "void"
    }));

    assert.deepEqual(grantsFor(access), {
      pixels: false,
      uv: true,
      uvStructure: false,
      palette: true,
      normalMap: true
    });
    assert.equal(access.viewOnly, false);
  });

  test("maps each action family to its capability", () => {
    const access = PixelArtAccess.fromRights(rights("read", {
      "uv-region-moved": "write",
      "uv-region-state-changed": "write",
      "uv-region-rotated": "write",
      "palette-color-changed": "write"
    }));

    assert.deepEqual(grantsFor(access), {
      pixels: false,
      uv: true,
      uvStructure: false,
      palette: true,
      normalMap: false
    });
  });
});
