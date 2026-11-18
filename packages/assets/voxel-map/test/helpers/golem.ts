// Import Third-party Dependencies
import { GOLEM_KINDS as PIXEL_ART_GOLEM_KINDS } from "@jolly-pixel/asset.pixel-art/golem";
import {
  TestStudio,
  type TestRoom
} from "@jolly-pixel/golem.kit/testing";

// Import Internal Dependencies
import {
  blocksetAssetKind,
  voxelMapAssetKind
} from "#src/index.ts";
import {
  GOLEM_KINDS,
  type VoxelMapAsset
} from "#src/golem/index.ts";

export interface Field {
  studio: TestStudio;
  map: VoxelMapAsset;
  room: TestRoom;
  blocksetId: string;
}

export function golemStudio(): TestStudio {
  return new TestStudio({
    kinds: [...GOLEM_KINDS, ...PIXEL_ART_GOLEM_KINDS]
  });
}

export async function defineBlock(
  studio: TestStudio,
  path: string,
  name = "stone"
): Promise<string> {
  const { id } = studio.host(path, blocksetAssetKind());
  const blockset = await studio.open(id, "blockset");
  await blockset.apply([
    {
      action: "block-defined",
      block: {
        id: 1,
        name,
        shapeId: "cube",
        faceTextures: {},
        collidable: true,
        properties: {}
      }
    }
  ]);
  await blockset.settled();

  return id;
}

export function blocksetAdded(
  id: string,
  slot: number,
  assetId: string
) {
  return {
    action: "blockset-added",
    blockset: {
      id,
      slot,
      asset: {
        id: assetId,
        kind: "blockset"
      }
    }
  };
}

export async function openField(): Promise<Field> {
  const studio = golemStudio();
  const hosted = studio.host("maps/field.voxelmap.json", voxelMapAssetKind());
  const blocksetId = await defineBlock(studio, "maps/field.blockset.json");
  const map = await studio.open(hosted.id, "voxelmap");
  await map.apply([blocksetAdded("default", 0, blocksetId)]);
  await map.addLayer({ name: "Ground" });
  await map.settled();

  return {
    studio,
    map,
    room: hosted.room,
    blocksetId
  };
}
