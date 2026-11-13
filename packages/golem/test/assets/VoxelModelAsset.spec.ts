// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

// Import Third-party Dependencies
import {
  VOXEL_MODEL_PRESENCE_KEYS,
  materialFieldLockPath,
  voxelModelDocumentKind,
  type SyncedModelDocument
} from "@jolly-pixel/asset.voxel-model/client";
import { PEER_FIELD_LOCK_KEY } from "@jolly-pixel/network/client";
import { UVRegion } from "@jolly-pixel/pixel-draw.renderer";
import type { ServedBackend } from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { LockedByPeerError } from "#src/assets/errors/LockedByPeerError.ts";
import type { VoxelModelAsset } from "#src/assets/voxelModel/VoxelModelAsset.ts";
import { UnknownEntryError } from "#src/assets/errors/UnknownEntryError.ts";
import { Golem } from "#src/peer/Golem.ts";
import { AssetPeer } from "../helpers/AssetPeer.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

// CONSTANTS
const kRegionIdentity = {
  id: "block",
  color: "#000"
};

interface Workshop {
  golem: Golem;
  model: VoxelModelAsset;
  person: AssetPeer<SyncedModelDocument>;
  [Symbol.dispose](): void;
}

async function openWorkshop(
  backend: ServedBackend
): Promise<Workshop> {
  const bob = await registered(backend, "Bob");
  const golem = await Golem.connect({
    url: backend.url,
    token: (await createAgentToken(backend, bob, "Builder")).value
  });
  const assetId = await golem.catalog.create("models/robot.voxelmodel.json", null);
  const model = await golem.open(assetId, "voxelmodel");
  const person = await AssetPeer.join({
    socketUrl: backend.socketUrl,
    credential: (await createAgentToken(backend, bob, "Watcher")).value,
    assetId,
    documentKind: voxelModelDocumentKind()
  });

  return {
    golem,
    model,
    person,
    [Symbol.dispose]() {
      person[Symbol.dispose]();
      golem.dispose();
    }
  };
}

async function seenByGolem(
  model: VoxelModelAsset,
  check: (presence: Record<string, unknown>) => boolean
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (![...model.peers()].some(({ presence }) => check(presence))) {
    assert.ok(Date.now() < deadline, "the golem never saw the presence");
    await delay(10);
  }
}

describe("VoxelModelAsset", { timeout: 10_000 }, () => {
  test("adds materials and blocks a watching person sees, with the golem's block mark", async() => {
    await using backend = await serveStudio();
    using workshop = await openWorkshop(backend);
    const { model, person } = workshop;

    const [steel] = await model.addMaterials([
      {
        name: "Steel",
        surface: {
          metalness: 1
        }
      }
    ]);
    const [arm] = await model.addBlocks([
      {
        name: "Arm",
        material: "Steel",
        shape: {
          type: "cylinder",
          sides: 8
        },
        transform: {
          size: {
            x: 1,
            y: 4,
            z: 1
          }
        }
      }
    ]);
    await model.settled();
    await person.until(() => person.synced.document.tree.nodes.block(arm.id) !== undefined &&
      person.peerNamed("Builder")?.presence[VOXEL_MODEL_PRESENCE_KEYS.block] === arm.id);

    const seen = person.synced.document.tree.nodes.block(arm.id);
    assert.equal(seen?.materialId, steel.id);
    assert.deepEqual(seen?.shape, { type: "cylinder", sides: 8 });
    assert.deepEqual(seen?.transform.size, { x: 1, y: 4, z: 1 });
    assert.equal(
      person.synced.document.tree.materials.material(steel.id)?.surface.metalness,
      1
    );
    await assert.rejects(
      model.addBlocks([{ name: "Leg", material: "Gold" }]),
      UnknownEntryError
    );
  });

  test("refuses to edit a block or a material field a person holds", async() => {
    await using backend = await serveStudio();
    using workshop = await openWorkshop(backend);
    const { model, person } = workshop;
    const [steel] = await model.addMaterials([{ name: "Steel" }]);
    const [arm] = await model.addBlocks([{ name: "Arm" }]);
    await model.settled();

    person.room.updatePresence({
      [VOXEL_MODEL_PRESENCE_KEYS.transformLock]: arm.id,
      [PEER_FIELD_LOCK_KEY]: materialFieldLockPath(steel.id, "color")
    });
    await seenByGolem(model, (presence) => presence[PEER_FIELD_LOCK_KEY] !== undefined);

    await assert.rejects(
      model.apply([
        {
          action: "node-transformed",
          id: arm.id,
          transform: model.tree.nodes.block(arm.id)!.transform
        }
      ]),
      (error: unknown) => error instanceof LockedByPeerError && error.peer === "Watcher"
    );
    await assert.rejects(
      model.apply([
        {
          action: "material-changed",
          id: steel.id,
          surface: {
            color: "#ff0000"
          }
        }
      ]),
      LockedByPeerError
    );
    await model.apply([
      {
        action: "material-changed",
        id: steel.id,
        surface: {
          roughness: 0.5
        }
      }
    ]);
    await model.settled();
    await assert.rejects(
      model.apply([
        {
          action: "material-removed",
          id: steel.id
        }
      ]),
      LockedByPeerError
    );
  });

  test("lays new blocks' faces out apart on the texture, growing it when full", async() => {
    await using backend = await serveStudio();
    using workshop = await openWorkshop(backend);
    const { golem, model } = workshop;
    const [texture] = golem.catalog.dependencies.listDependencies(model.id);
    const pixels = await golem.open(texture.id, "pixelart");
    const before = pixels.read().size;

    const added = await model.addBlocks(
      Array.from({ length: 6 }, (_, index) => {
        return { name: `Block ${index}` };
      })
    );
    await model.settled();

    const size = pixels.read().size;
    assert.ok(size.x * size.y > before.x * before.y);
    const rects = Array.from(
      model.tree.nodes.blocks(),
      (block) => UVRegion.fromLayout(block.uv, kRegionIdentity).bounds
    );
    assert.deepEqual(
      added.map(({ uv }) => uv),
      rects.slice(-added.length)
    );
    assert.ok(added.every(({ shared }) => !shared));
    for (const [index, rect] of rects.entries()) {
      assert.ok(rect.x + rect.width <= size.x && rect.y + rect.height <= size.y);
      for (const other of rects.slice(index + 1)) {
        assert.ok(
          rect.x + rect.width <= other.x || other.x + other.width <= rect.x ||
          rect.y + rect.height <= other.y || other.y + other.height <= rect.y,
          `${JSON.stringify(rect)} overlaps ${JSON.stringify(other)}`
        );
      }
    }
  });
});
