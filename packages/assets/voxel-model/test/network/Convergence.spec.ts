// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import {
  voxelModelAssetKind,
  type ModelDocument
} from "#src/index.ts";
import type { VoxelModelSnapshot } from "#src/network/types.ts";
import { voxelModelDocumentKind } from "#src/network/voxelModelDocumentKind.ts";
import {
  TRANSFORM,
  blockAdded,
  folderAdded,
  materialAdded,
  networkCommand
} from "../helpers/commands.ts";
import { createMockRoom } from "../helpers/room.ts";

function nodeIds(
  nodes: Iterable<{ id: string; }>
): string[] {
  return [...nodes].map((node) => node.id).sort();
}

function takeSnapshot(
  document: ModelDocument
) {
  return {
    nodes: [...document.tree.values()],
    materials: [...document.tree.materials.values()],
    animationSets: [...document.tree.animationSets.values()]
  };
}

async function setup() {
  const server = new LiveAssetRoom(voxelModelAssetKind());
  await server.receive("A", networkCommand(folderAdded("N"), { clientId: "A" }));
  await server.receive("A", networkCommand(blockAdded("M"), { clientId: "A" }));
  await server.receive("A", networkCommand(blockAdded("K"), { clientId: "A" }));

  const room = createMockRoom("B");
  const { document } = voxelModelDocumentKind().syncDocument(room);

  function deliver(): void {
    for (const message of server.take<VoxelModelSnapshot>("B")) {
      room.deliver(message);
    }
  }

  await server.connect("B");
  deliver();

  return {
    server,
    document,
    deliver,
    async flush(): Promise<void> {
      for (const sent of room.sent.splice(0)) {
        await server.receive("B", sent);
      }
    }
  };
}

describe("voxel-model convergence", () => {
  test("C3: a node moved into a folder the author removed is removed with it", async() => {
    const { server, document, deliver, flush } = await setup();

    document.remove("N");
    await server.receive("A", networkCommand({
      action: "node-moved",
      id: "M",
      parentId: "N",
      transforms: []
    }, { clientId: "A" }));
    await flush();
    deliver();

    assert.deepStrictEqual(nodeIds(server.state.snapshot().nodes), ["K"]);
    assert.deepStrictEqual(nodeIds(document.tree.values()), ["K"]);
  });

  test("a rebased pending removal keeps the server sibling order", async() => {
    const { server, document, deliver, flush } = await setup();

    document.remove("M");
    await server.receive("A", networkCommand(blockAdded("Z"), { clientId: "A" }));
    deliver();
    await flush();
    deliver();

    assert.deepStrictEqual(
      [...document.tree.values()],
      server.state.snapshot().nodes
    );
  });

  test("a rebased pending reorder keeps the server sibling order", async() => {
    const { server, document, deliver, flush } = await setup();

    document.move("M", null);
    await server.receive("A", networkCommand({ ...blockAdded("Z"), beforeId: "M" }, { clientId: "A" }));
    deliver();
    await flush();
    deliver();

    assert.deepStrictEqual(
      [...document.tree.values()],
      server.state.snapshot().nodes
    );
  });

  test("a peer move before a pending removal lands where the removed node stood", async() => {
    const { server, document, deliver, flush } = await setup();

    document.remove("N");
    await server.receive("A", networkCommand({
      action: "node-moved",
      id: "K",
      parentId: null,
      transforms: [],
      beforeId: "N"
    }, { clientId: "A" }));
    deliver();
    await flush();
    deliver();

    assert.deepStrictEqual(
      [...document.tree.values()],
      server.state.snapshot().nodes
    );
  });

  test("a pending move into a folder a peer removed leaves the view until the server repairs it", async() => {
    const { server, document, deliver, flush } = await setup();

    document.move("M", "N");
    await server.receive("A", networkCommand({ action: "node-removed", id: "N" }, { clientId: "A" }));
    deliver();
    assert.deepStrictEqual(nodeIds(document.tree.values()), ["K", "M"]);
    assert.strictEqual(document.tree.get("M")?.parentId, null);

    await flush();
    deliver();

    assert.deepStrictEqual(
      [...document.tree.values()],
      server.state.snapshot().nodes
    );
  });

  test("a newer local transform survives an older peer transform", async() => {
    const { server, document, deliver, flush } = await setup();
    const moved = {
      ...TRANSFORM,
      position: { x: 4, y: 0, z: 0 }
    };

    document.transform("M", moved);
    await server.receive("A", networkCommand({
      action: "node-transformed",
      id: "M",
      transform: { ...TRANSFORM, position: { x: 9, y: 9, z: 9 } }
    }, { clientId: "A", timestamp: 1 }));
    await flush();
    deliver();

    assert.deepStrictEqual(document.tree.block("M")?.transform, moved);
    assert.deepStrictEqual(
      [...document.tree.values()],
      server.state.snapshot().nodes
    );
  });

  test("a rebased pending material removal keeps the rest of the library", async() => {
    const { server, document, deliver, flush } = await setup();
    await server.receive("A", networkCommand(materialAdded("iron"), { clientId: "A" }));
    await server.receive("A", networkCommand(materialAdded("glass"), { clientId: "A" }));
    await server.receive("A", networkCommand({
      action: "node-material-changed",
      id: "M",
      materialId: "glass"
    }, { clientId: "A" }));
    deliver();

    document.removeMaterial("glass");
    await server.receive("A", networkCommand(blockAdded("Z"), { clientId: "A" }));
    deliver();

    assert.strictEqual(document.tree.materials.has("glass"), false);
    assert.strictEqual(document.tree.materials.has("iron"), true);
    assert.strictEqual(document.tree.blockMaterialId("M"), undefined);

    await flush();
    deliver();

    assert.deepStrictEqual(takeSnapshot(document), server.state.snapshot());
  });

  test("a newer local surface change survives an older peer change of the same field", async() => {
    const { server, document, deliver, flush } = await setup();
    await server.receive("A", networkCommand(materialAdded("glass"), { clientId: "A" }));
    deliver();

    document.changeMaterial("glass", { opacity: 0.5 });
    await server.receive("A", networkCommand({
      action: "material-changed",
      id: "glass",
      surface: { opacity: 0.1, roughness: 0.2 }
    }, { clientId: "A", timestamp: 1 }));
    await flush();
    deliver();

    const surface = document.tree.materials.material("glass")?.surface;
    assert.strictEqual(surface?.opacity, 0.5);
    assert.strictEqual(surface?.roughness, 0.2);
    assert.deepStrictEqual(takeSnapshot(document), server.state.snapshot());
  });

  test("a pending set link and binding survive a peer edit rebased before them", async() => {
    const { server, document, deliver, flush } = await setup();

    document.linkAnimationSet({ id: "walk", kind: "voxelanimation" });
    document.remapAnimationTrack("walk", "M", "Body/M");
    await server.receive("A", networkCommand(blockAdded("Z"), { clientId: "A" }));
    deliver();

    assert.deepStrictEqual(
      document.tree.animationSets.get("walk")?.bindings,
      [{ path: "M", target: "Body/M" }]
    );

    await flush();
    deliver();
    assert.deepStrictEqual(takeSnapshot(document), server.state.snapshot());
  });
});
