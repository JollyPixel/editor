// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import {
  DEFAULT_TERRAIN_TEXTURE_SIZE,
  encodeTerrainFile,
  GROUND_MATERIAL,
  terrainAssetKind,
  TERRAIN_FILE_VERSION
} from "#src/index.ts";
import { MAX_TERRAIN_MATERIALS } from "#src/network/TerrainCommand.schema.ts";
import {
  material,
  networkCommand
} from "../helpers/terrain.ts";

// CONSTANTS
const kRockMap = { id: "rock-albedo", kind: "texture" };
const kRockNormal = { id: "rock-normal", kind: "texture" };
const kRockHeight = { id: "rock-height", kind: "texture" };

function liveRoom() {
  return new LiveAssetRoom(terrainAssetKind());
}

function materialSlots(
  room: ReturnType<typeof liveRoom>
): number[] {
  return room.state.materials.materials().map(({ slot }) => slot);
}

describe("terrain materials", () => {
  test("a document without materials loads the Ground material at the default texture size", () => {
    const handler = terrainAssetKind();
    const model = handler.create("asset");
    model.materials.load([material("rock", 3)], 2048);

    handler.load(model, encodeTerrainFile({
      version: TERRAIN_FILE_VERSION,
      chunks: [{ x: 0, z: 0 }]
    }));

    assert.deepEqual(model.materials.materials(), [GROUND_MATERIAL]);
    assert.equal(model.materials.textureSize, DEFAULT_TERRAIN_TEXTURE_SIZE);
  });

  test("load rejects a document whose materials share a slot", () => {
    const handler = terrainAssetKind();
    const content = encodeTerrainFile({
      version: TERRAIN_FILE_VERSION,
      chunks: [{ x: 0, z: 0 }],
      materials: [material("rock", 0), material("sand", 0)]
    });

    assert.throws(() => handler.load(handler.create("asset"), content), InvalidAssetFileError);
  });

  test("the materials' images are the terrain's dependencies, and rebind follows new IDs", () => {
    const handler = terrainAssetKind();
    const model = handler.create("asset");
    model.materials.add(material("rock", 1, { albedo: kRockMap, normal: kRockNormal, height: kRockHeight }));
    model.materials.add(material("moss", 2, { albedo: kRockMap }));

    assert.deepEqual(handler.dependencies!(model), [kRockMap, kRockNormal, kRockHeight]);

    handler.rebind!(model, new Map([[kRockMap.id, "rock-copy"]]));

    assert.deepEqual(
      handler.dependencies!(model),
      [{ ...kRockMap, id: "rock-copy" }, kRockNormal, kRockHeight]
    );
  });

  test("a material is admitted only with a new ID, on a free slot, under the material cap", () => {
    const room = liveRoom();
    function add(id: string, slot: number): void {
      room.receive("A", networkCommand({ action: "material-added", material: material(id, slot) }));
    }
    add("ground", 4);
    add("rock", 0);
    for (let slot = 1; slot <= MAX_TERRAIN_MATERIALS; slot++) {
      add(`material-${slot}`, slot);
    }

    assert.deepEqual(materialSlots(room), Array.from({ length: MAX_TERRAIN_MATERIALS }, (_, slot) => slot));
  });

  test("an update of a removed material and an unchanged texture size are refused", () => {
    const room = liveRoom();
    room.connect("A");
    room.take("A");
    room.receive("A", networkCommand({ action: "material-removed", id: GROUND_MATERIAL.id }));
    room.receive("A", networkCommand({
      action: "material-updated",
      id: GROUND_MATERIAL.id,
      changes: { tiling: 8 }
    }));
    room.receive("A", networkCommand({ action: "texture-size-changed", size: DEFAULT_TERRAIN_TEXTURE_SIZE }));

    assert.deepEqual(materialSlots(room), []);
    assert.deepEqual(
      room.take("A").map(({ type }) => type),
      ["command", "snapshot", "snapshot"]
    );
  });
});
