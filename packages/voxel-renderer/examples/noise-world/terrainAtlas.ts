// Import Third-party Dependencies
import type {
  BlendGroupJSON,
  BlockDefinition,
  BlocksetDefinition,
  TileRef
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { AtlasCanvas } from "../shared/AtlasCanvas.ts";
import {
  TerrainBlock,
  type TerrainBlockId
} from "./blocks.ts";
import {
  Palette,
  TILE_SIZE,
  TileCanvas,
  type TilePainter
} from "./tile.ts";
import {
  bark,
  birchBark,
  capSide,
  foliage,
  granular,
  grassTop,
  logEnd,
  ripples,
  rock,
  snow,
  water
} from "./painters.ts";

// CONSTANTS
const kCols = 4;

const kGrass = new Palette("#3a7520", "#468a26", "#539e2c", "#62b033", "#74c03b", "#89cf45", "#a0dc55");
const kDirt = new Palette("#5a3a22", "#6b4629", "#7d5331", "#8f613a", "#a17045", "#b38052");
const kSand = new Palette("#b8a36a", "#c9b57c", "#d8c48d", "#e3d19e", "#ecdcb0", "#f4e8c6");
const kRock = new Palette("#4a403a", "#5e524a", "#74665b", "#8a7a6c", "#a0907f");
const kSnow = new Palette("#a9b8cc", "#c3d0e0", "#d9e2ee", "#e9eff6", "#f5f8fc", "#ffffff");
const kWater = new Palette("#1d4b8a", "#255c9c", "#2f6ead", "#3b80bd", "#5597cc", "#7fb5de");
const kLeaves = new Palette("#1f4a1a", "#2a5f21", "#37752a", "#468c33", "#5aa43f", "#74bb4e");
const kBark = new Palette("#3b2818", "#4f3620", "#644429", "#7a5433", "#8f6541");
const kPine = new Palette("#10301f", "#173d27", "#1f4b30", "#2a5c3a", "#376d45", "#467e50");
const kBirchLeaves = new Palette("#3f6b1f", "#4f8226", "#62982f", "#77ad3a", "#8fc248", "#a8d35c");
const kBirchBark = new Palette("#2b2622", "#8f8a80", "#c9c4b8", "#e2ded4", "#f2efe8");
const kHeartwood = new Palette("#8a6238", "#a57a48", "#bf935b", "#d4ab70", "#e2c08a");

const kTiles = {
  grassTop: grassTop(kGrass),
  grassSide: capSide(kGrass, granular(kDirt)),
  dirt: granular(kDirt),
  stone: rock(kRock),
  sandTop: ripples(kSand),
  sand: granular(kSand),
  snowTop: snow(kSnow),
  snowSide: capSide(kSnow, rock(kRock)),
  water: water(kWater),
  bark: bark(kBark),
  logEnd: logEnd(kHeartwood, kBark),
  leaves: foliage(kLeaves),
  pineLeaves: foliage(kPine),
  birchBark: birchBark(kBirchBark),
  birchLeaves: foliage(kBirchLeaves),
  birchEnd: logEnd(kHeartwood, kBirchBark)
} as const satisfies Record<string, TilePainter>;
type TileName = keyof typeof kTiles;

const kTileNames = Object.keys(kTiles) as TileName[];

interface TerrainBlockSpec extends Pick<
  BlockDefinition,
  "collidable" | "alphaMode" | "cullCoveredFaces" | "blendGroup"
> {
  id: TerrainBlockId;
  name: string;
  tile: TileName;
  top?: TileName;
  bottom?: TileName;
}

const kFoliage = {
  collidable: false,
  alphaMode: "mask",
  cullCoveredFaces: true
} as const satisfies Partial<TerrainBlockSpec>;

const kBlockSpecs: TerrainBlockSpec[] = [
  {
    id: TerrainBlock.Grass,
    name: "Grass",
    tile: "grassSide",
    top: "grassTop",
    bottom: "dirt",
    blendGroup: "grass"
  },
  { id: TerrainBlock.Dirt, name: "Dirt", tile: "dirt", blendGroup: "dirt" },
  { id: TerrainBlock.Stone, name: "Stone", tile: "stone", blendGroup: "stone" },
  { id: TerrainBlock.Sand, name: "Sand", tile: "sand", top: "sandTop", blendGroup: "sand" },
  {
    id: TerrainBlock.Snow,
    name: "Snow",
    tile: "snowSide",
    top: "snowTop",
    bottom: "stone",
    blendGroup: "snow"
  },
  { id: TerrainBlock.Water, name: "Water", tile: "water", collidable: false },
  { id: TerrainBlock.Log, name: "Log", tile: "bark", top: "logEnd", bottom: "logEnd" },
  { id: TerrainBlock.Leaves, name: "Leaves", tile: "leaves", ...kFoliage },
  { id: TerrainBlock.PineLeaves, name: "Pine leaves", tile: "pineLeaves", ...kFoliage },
  { id: TerrainBlock.BirchLog, name: "Birch log", tile: "birchBark", top: "birchEnd", bottom: "birchEnd" },
  { id: TerrainBlock.BirchLeaves, name: "Birch leaves", tile: "birchLeaves", ...kFoliage }
];

export const TERRAIN_BLEND_GROUPS: readonly BlendGroupJSON[] = [
  { id: "grass", width: 10, priority: 2 },
  { id: "sand", width: 8, priority: 1 },
  { id: "dirt", width: 8, priority: 1 },
  { id: "stone", width: 6 },
  { id: "snow", width: 12, priority: 3 }
];

export interface TerrainBlockset {
  definition: BlocksetDefinition;
  blocks: BlockDefinition[];
}

export function createTerrainBlockset(
  id = "terrain"
): TerrainBlockset {
  const atlas = new AtlasCanvas({
    cols: kCols,
    rows: Math.ceil(kTileNames.length / kCols),
    tileSize: TILE_SIZE
  });
  for (const [index, name] of kTileNames.entries()) {
    const tile = new TileCanvas(index + 1);
    kTiles[name](tile);
    atlas.putImage(
      atlas.tileAt(index),
      new ImageData(tile.pixels, TILE_SIZE, TILE_SIZE)
    );
  }

  return {
    definition: atlas.toBlockset(id),
    blocks: kBlockSpecs.map((spec) => toBlockDefinition(atlas, spec))
  };
}

function toBlockDefinition(
  atlas: AtlasCanvas,
  spec: TerrainBlockSpec
): BlockDefinition {
  const { tile, top, bottom, ...surface } = spec;
  const faceTextures: Partial<Record<"top" | "bottom", TileRef>> = {};
  if (top) {
    faceTextures.top = tileRef(atlas, top);
  }
  if (bottom) {
    faceTextures.bottom = tileRef(atlas, bottom);
  }

  return {
    ...surface,
    shapeId: "cube",
    collidable: surface.collidable ?? true,
    faceTextures,
    defaultTexture: tileRef(atlas, tile)
  };
}

function tileRef(
  atlas: AtlasCanvas,
  name: TileName
): TileRef {
  return atlas.tileAt(kTileNames.indexOf(name));
}
