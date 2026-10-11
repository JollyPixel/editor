// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ShareLink } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import {
  ShareLinkRow,
  type ShareLinkLookups
} from "../../src/shares/ShareLinkRow.ts";

// CONSTANTS
const kLookups: ShareLinkLookups = {
  assetPath: (assetId) => (assetId === "map-1" ? "maps/overworld.voxelmap.json" : undefined),
  username: (accountId) => (accountId === "alice" ? "Alice" : undefined),
  baseUrl: "http://studio.local/projects/demo/"
};

function link(
  overrides: Partial<ShareLink>
): ShareLink {
  return {
    id: "link-1",
    token: "token-1",
    assetId: "map-1",
    createdBy: "alice",
    createdAt: Date.UTC(2026, 9, 11, 12),
    expiresAt: null,
    ...overrides
  };
}

describe("ShareLinkRow", () => {
  test("names the asset and creator and builds the view URL against the studio base", () => {
    const row = new ShareLinkRow(link({
      expiresAt: Date.UTC(2026, 9, 18, 12)
    }), kLookups);

    assert.deepEqual({ ...row }, {
      id: "link-1",
      asset: "maps/overworld.voxelmap.json",
      url: "http://studio.local/projects/demo/view/token-1",
      creator: "Alice",
      created: "Oct 11, 2026",
      expires: "Expires Oct 18, 2026"
    });
  });

  test("still describes a link whose asset or creator is gone", () => {
    const row = new ShareLinkRow(link({
      assetId: "deleted",
      createdBy: "bob"
    }), kLookups);

    assert.deepEqual(
      [row.asset, row.creator, row.expires],
      ["Deleted asset", "a removed account", "Never expires"]
    );
  });

  test("lists the newest link first", () => {
    const rows = ShareLinkRow.newestFirst([
      link({ id: "old", createdAt: 1 }),
      link({ id: "new", createdAt: 2 })
    ], kLookups);

    assert.deepEqual(rows.map((row) => row.id), ["new", "old"]);
  });
});
