// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import { GOLEM_KINDS as PIXEL_ART_GOLEM_KINDS } from "@jolly-pixel/asset.pixel-art/golem";
import {
  LockedByPeerError,
  UnknownEntryError
} from "@jolly-pixel/golem.kit";
import {
  TestStudio,
  type TestRoom
} from "@jolly-pixel/golem.kit/testing";
import { PEER_FIELD_LOCK_KEY } from "@jolly-pixel/network/client";
import { UVRegion } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { voxelModelAssetKind } from "#src/index.ts";
import {
  materialFieldLockPath,
  VOXEL_MODEL_PRESENCE_KEYS
} from "#src/network/presenceKeys.ts";
import {
  GOLEM_KINDS,
  type VoxelModelAsset
} from "#src/golem/index.ts";

// CONSTANTS
const kRegionIdentity = {
  id: "block",
  color: "#000"
};

interface Workshop {
  studio: TestStudio;
  model: VoxelModelAsset;
  textureId: string;
  room: TestRoom;
}

async function openWorkshop(): Promise<Workshop> {
  const studio = new TestStudio({
    kinds: [...GOLEM_KINDS, ...PIXEL_ART_GOLEM_KINDS]
  });
  const texture = studio.host(
    "models/robot.pixelart",
    pixelArtAssetKind({ defaultSize: { x: 32, y: 32 } })
  );
  const { id, room } = studio.host("models/robot.voxelmodel.json", voxelModelAssetKind());
  studio.dependencies.set(id, [
    {
      id: texture.id,
      kind: PIXEL_ART_KIND
    }
  ]);

  return {
    studio,
    room,
    textureId: texture.id,
    model: await studio.open(id, "voxelmodel")
  };
}

describe("VoxelModelAsset", () => {
  test("adds materials and blocks that use them, with the golem's block mark", async() => {
    const { model, room } = await openWorkshop();

    const [steel] = await model.addMaterials({
      materials: [
        {
          name: "Steel",
          surface: {
            metalness: 1
          }
        }
      ]
    });
    const [arm] = await model.addBlocks({
      blocks: [
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
      ]
    });
    await model.settled();

    const block = model.tree.nodes.block(arm.id);
    assert.equal(block?.materialId, steel.id);
    assert.deepEqual(block?.shape, { type: "cylinder", sides: 8 });
    assert.deepEqual(block?.transform.size, { x: 1, y: 4, z: 1 });
    assert.equal(model.tree.materials.material(steel.id)?.surface.metalness, 1);
    assert.equal(room.presence[VOXEL_MODEL_PRESENCE_KEYS.block], arm.id);
    await assert.rejects(
      model.addBlocks({ blocks: [{ name: "Leg", material: "Gold" }] }),
      UnknownEntryError
    );
  });

  test("refuses to edit a block or a material field a person holds", async() => {
    const { model, room } = await openWorkshop();
    const [steel] = await model.addMaterials({ materials: [{ name: "Steel" }] });
    const [arm] = await model.addBlocks({ blocks: [{ name: "Arm" }] });
    await model.settled();

    room.addPeer({
      clientId: "person",
      role: "member",
      profile: {
        username: "Watcher"
      },
      presence: {
        [VOXEL_MODEL_PRESENCE_KEYS.transformLock]: arm.id,
        [PEER_FIELD_LOCK_KEY]: materialFieldLockPath(steel.id, "color")
      }
    });

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
    const { studio, model, textureId } = await openWorkshop();
    const pixels = await studio.open(textureId, "pixelart");
    const before = pixels.read().size;

    const added = await model.addBlocks({
      blocks: Array.from({ length: 6 }, (_, index) => {
        return { name: `Block ${index}` };
      })
    });
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
