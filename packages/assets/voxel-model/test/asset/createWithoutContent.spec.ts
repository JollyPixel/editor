// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import { createAssetBackend } from "@jolly-pixel/asset-server";
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";

// Import Internal Dependencies
import {
  VOXEL_MODEL_KIND,
  decodeVoxelModelFile,
  voxelModelAssetKind
} from "#src/index.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("voxel model created without content", () => {
  test("comes with a same-named texture it references and one block", async() => {
    using eventStore = EventStore.persistence.memory();
    const source = new MemoryAssetSource();
    await using backend = await createAssetBackend({
      source,
      eventStore,
      handlers: [voxelModelAssetKind(), pixelArtAssetKind()],
      reconcile: {
        watch: false
      }
    });

    const model = (await backend.writer.create({
      path: "models/new.voxelmodel.json",
      kind: VOXEL_MODEL_KIND,
      actor: kActor
    })).unwrap();
    await backend.flush();

    const texture = backend.catalog.snapshot().assets
      .find((record) => record.path === "models/new.pixelart");
    assert.strictEqual(texture?.kind, PIXEL_ART_KIND);

    const reference = {
      id: texture.id,
      kind: PIXEL_ART_KIND
    };
    assert.deepEqual(
      backend.catalog.dependencies.listDependencies(model.assetId),
      [reference]
    );

    const file = decodeVoxelModelFile(
      await source.read("models/new.voxelmodel.json")
    );
    assert.deepEqual(file.texture, reference);
    assert.deepEqual(file.nodes.map((node) => node.kind), ["block"]);
  });
});
