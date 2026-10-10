// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import {
  createAssetBackend,
  InvalidAssetDocumentError
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  createVoxelAnimationDocument,
  decodeVoxelAnimationDocument,
  encodeVoxelAnimationDocument,
  VOXEL_ANIMATION_KIND,
  voxelAnimationAssetKind
} from "#src/index.ts";
import {
  clip,
  key
} from "../helpers/clips.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("voxel animation document", () => {
  test("round-trips through its codec", () => {
    const document = createVoxelAnimationDocument({
      rig: "Humanoid",
      clips: [clip("walk", { tracks: [{ path: "body", rotation: [key(0, 15)] }] })]
    });

    assert.deepEqual(
      decodeVoxelAnimationDocument(encodeVoxelAnimationDocument(document)),
      document
    );
  });

  test("stores linear keys without their interpolation", () => {
    const document = createVoxelAnimationDocument({
      clips: [clip("walk", { tracks: [{ path: "body", rotation: [key(0, 15), key(12, 30, "smooth")] }] })]
    });

    const stored = JSON.parse(new TextDecoder().decode(encodeVoxelAnimationDocument(document)));

    assert.deepEqual(stored.clips[0].tracks[0].rotation, [
      { tick: 0, value: { x: 15, y: 0, z: 0 } },
      { tick: 12, value: { x: 30, y: 0, z: 0 }, interpolation: "smooth" }
    ]);
  });

  test("rejects bytes that are not JSON or not a set", () => {
    const encoder = new TextEncoder();

    assert.throws(
      () => decodeVoxelAnimationDocument(encoder.encode("{")),
      InvalidAssetDocumentError
    );
    assert.throws(
      () => decodeVoxelAnimationDocument(encoder.encode(JSON.stringify({ version: 1, rig: "" }))),
      InvalidAssetDocumentError
    );
  });

  test("an asset created without content is an empty set", async() => {
    using eventStore = EventStore.persistence.memory();
    const source = new MemoryAssetSource();
    await using backend = await createAssetBackend({
      source,
      eventStore,
      handlers: [voxelAnimationAssetKind()],
      watch: false
    });

    const created = (await backend.writer.create({
      path: "animations/humanoid.voxelanim.json",
      kind: VOXEL_ANIMATION_KIND,
      actor: kActor
    })).unwrap();
    await backend.flush();

    const record = backend.catalog.snapshot().assets
      .find(({ id }) => id === created.assetId);
    assert.equal(record?.kind, VOXEL_ANIMATION_KIND);
    assert.deepEqual(
      decodeVoxelAnimationDocument(await source.read("animations/humanoid.voxelanim.json")),
      createVoxelAnimationDocument()
    );
  });
});
