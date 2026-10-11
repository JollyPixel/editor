// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";
import type { PeerIdentity } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { StudioShares } from "../../../server/shares/StudioShares.ts";
import {
  guestUpgrade,
  shareAccounts,
  type ShareAccounts
} from "../../helpers/shares.ts";

interface SharesHarness extends ShareAccounts {
  linkId: string;
  member: PeerIdentity;
  guest(): PeerIdentity;
}

async function sharesHarness(): Promise<SharesHarness> {
  const setup = await shareAccounts({
    "map-1": ["map-1", "blockset-1"]
  });
  const link = setup.accounts.shareLinks.create({
    assetId: "map-1",
    createdBy: setup.owner.id,
    expiresAt: null
  });

  return {
    ...setup,
    linkId: link.id,
    member: {
      subject: setup.owner.id,
      role: "member"
    },
    guest() {
      const identity = setup.accounts.authenticate(guestUpgrade(link.token));
      assert.ok(identity !== null);

      return identity;
    }
  };
}

async function admitted(
  shares: StudioShares,
  identity: PeerIdentity
): Promise<string[]> {
  const rooms = [
    "asset-catalog-view",
    new AssetRoom("voxelmap", "map-1").toString(),
    new AssetRoom("blockset", "blockset-1").toString(),
    new AssetRoom("voxelmap", "map-2").toString(),
    "asset-catalog",
    "accounts"
  ];
  const verdicts = await Promise.all(
    rooms.map((room) => shares.admits(identity, room))
  );

  return rooms.filter((_room, index) => verdicts[index]);
}

describe("StudioShares.admits", () => {
  test("admits a guest to the catalog view and the rooms of its closure only", async() => {
    using harness = await sharesHarness();

    assert.deepEqual(await admitted(harness.shares, harness.guest()), [
      "asset-catalog-view",
      "voxelmap:map-1",
      "blockset:blockset-1"
    ]);
    assert.equal(harness.shares.scope(harness.guest()), "map-1");
  });

  test("leaves signed-in accounts to the rights table", async() => {
    using harness = await sharesHarness();

    assert.equal((await admitted(harness.shares, harness.member)).length, 6);
    assert.equal(harness.shares.scope(harness.member), null);
  });

  test("admits nothing once the link is revoked", async() => {
    using harness = await sharesHarness();
    const guest = harness.guest();

    harness.accounts.shareLinks.revoke(harness.owner.id, harness.linkId);

    assert.deepEqual(await admitted(harness.shares, guest), []);
  });
});
