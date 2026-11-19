// Import Third-party Dependencies
import { expect } from "@playwright/test";
import type { Vector3Like } from "three";
import { Scenario } from "@jolly-pixel/e2e/scenario";

// Import Internal Dependencies
import {
  Blueprint,
  part,
  voxel,
  type Drawing
} from "./support/Blueprint.ts";
import {
  MapArchive,
  type MapLayer
} from "./support/MapArchive.ts";
import {
  TILESET_BLOCKS,
  writeTileset
} from "./support/tileset.ts";
import {
  cameraAbove,
  type Cell
} from "./support/viewport.ts";
import { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kCamera = cameraAbove({ x: 0, y: 0, z: 0.5 }, 13, 11);
const kGround = "Ground";
const kTrees = "Trees";
const kShallows = "Shallows";
const kBridge = "Bridge";
const kSlope = "Slope";
const kCompass = "Compass";

const kIsland = Blueprint.site({
  west: -5,
  north: -5,
  width: 11,
  depth: 11,
  legend: {
    G: "Grass",
    S: "Sand",
    "~": kShallows,
    "=": voxel(part(kShallows), part(kBridge)),
    "^": kSlope,
    ">": voxel(part(kSlope, { rotation: 1 })),
    "<": voxel(part(kSlope, { rotation: 3 })),
    c: voxel(part(kCompass, { rotation: 1, flipY: true })),
    C: voxel(part(kCompass, { rotation: 0, flipY: true })),
    W: "Wood",
    L: "Leaves"
  }
});
const kHill = kIsland.with({
  0: [
    "...GGGGG...",
    "..GGGGGGG..",
    ".GGGGGGGGG.",
    "GGGGGGGGGGG",
    "GGGGGGGGGGG",
    "GGGGGGGGGGG",
    "GGGGGGSGGGG",
    "GGGGGGSGGGG",
    ".GGSSSSGGG.",
    "..GGGGGGG..",
    "...GGGGG..."
  ],
  1: [
    "",
    "",
    "..GGG",
    ".GGGGG",
    ".GGGGG",
    ".GGGGG",
    "..GGG"
  ]
});
const kPond = kHill.with({
  0: [
    "",
    "",
    "",
    "",
    "",
    "       ~~~",
    "       ~~~",
    "       ~~~"
  ]
});
const kBridged = kPond.with({
  0: [
    "",
    "",
    "",
    "",
    "",
    "",
    "       ===",
    "        ="
  ]
});
const kSignposted = kBridged.with({
  1: [
    "",
    "",
    "",
    "",
    ">     <",
    "",
    "",
    "   ^",
    "  c"
  ]
});
const kMoved = kSignposted.with({
  1: [
    "",
    "",
    "",
    "",
    "",
    "",
    "          C",
    "",
    "  ."
  ]
});
const kTree = kMoved.with({
  1: ["", "", "", "", "", "", " W"],
  2: ["", "", "", "", "", "", " W"],
  3: ["", "", "", "", "", "LLL", "LLL", "LLL"],
  4: ["", "", "", "", "", "", " L"]
});
const kForest = kTree.with({
  1: ["", "", "", "       W"],
  2: ["", "", "", "       W"],
  3: ["", "", "      LLL", "      LLL", "      LLL"],
  4: ["", "", "", "       L"]
});
const kTreeVoxels = 12;

const kTrunk: Cell = { x: -4, y: 1, z: 1 };
const kPondCenter: Cell = { x: 3, y: 0, z: 1 };
const kCompassFrom: Cell = { x: -3, y: 1, z: 3 };
const kCompassTo: Cell = { x: 5, y: 1, z: 1 };
const kSapling: Cell = { x: 2, y: 1, z: -2 };

interface BlockShape {
  name: string;
  shape: string;
}

interface TerrainExpectation {
  layers: MapLayer[];
  imported: number;
  blocks: BlockShape[];
  drawing: Drawing;
  strays: string[];
}

const kStarter: BlockShape = { name: "Stone", shape: "cube" };

const kBlank: TerrainExpectation = {
  layers: [{ name: kGround, voxels: 0 }],
  imported: 0,
  blocks: [kStarter],
  drawing: {},
  strays: []
};
const kTileset: TerrainExpectation = {
  ...kBlank,
  imported: TILESET_BLOCKS.length
};
const kShapes: TerrainExpectation = {
  ...kTileset,
  blocks: [
    kStarter,
    { name: kBridge, shape: "slabTop" },
    { name: kSlope, shape: "ramp" },
    { name: kShallows, shape: "slabBottom" }
  ]
};
const kHillShaped: TerrainExpectation = {
  ...kShapes,
  layers: [{ name: kGround, voxels: 118 }],
  drawing: kHill.drawing()
};
const kPondDug: TerrainExpectation = {
  ...kHillShaped,
  drawing: kPond.drawing()
};
const kBridgeBuilt: TerrainExpectation = {
  ...kPondDug,
  drawing: kBridged.drawing()
};
const kSignpostPlaced: TerrainExpectation = {
  ...kBridgeBuilt,
  layers: [{ name: kGround, voxels: 122 }],
  drawing: kSignposted.drawing()
};
const kSignpostMoved: TerrainExpectation = {
  ...kSignpostPlaced,
  drawing: kMoved.drawing()
};
const kForested: TerrainExpectation = {
  ...kSignpostMoved,
  layers: [
    { name: kTrees, voxels: kTreeVoxels * 2 },
    { name: kGround, voxels: 122 }
  ],
  drawing: kForest.drawing()
};

function above(
  cell: Cell
): Cell {
  return { ...cell, y: cell.y + 1 };
}

function slabTop(
  cell: Cell
): Vector3Like {
  return { x: cell.x + 0.5, y: cell.y + 0.5, z: cell.z + 0.5 };
}

async function repeat(
  times: number,
  action: () => Promise<void>
): Promise<void> {
  for (let index = 0; index < times; index++) {
    await action();
  }
}

new Scenario<VoxelMapPage, TerrainExpectation>({
  id: "shape-terrain",
  title: "shape an island with a hill, a pond, a bridge and a forest",
  open: async(page) => {
    const map = new VoxelMapPage(page);
    await map.openOffline();

    return map;
  },
  ready: (map) => map.viewport.pinCamera(kCamera),
  describe: (archive) => {
    const map = new MapArchive(archive);
    const blocks = map.blocks();
    const { drawing, strays } = kIsland.survey(map.voxels());

    return {
      layers: map.layers(),
      imported: blocks.filter(
        (block) => TILESET_BLOCKS.includes(block.name)
      ).length,
      blocks: blocks
        .filter((block) => !TILESET_BLOCKS.includes(block.name))
        .map(({ name, shape }) => {
          return { name, shape };
        }),
      drawing,
      strays
    };
  },
  chapters: [
    {
      id: "blank",
      title: "the blank map holds the starter block only",
      play: () => Promise.resolve(),
      expected: kBlank
    },
    {
      id: "tileset",
      title: "import the placeholder tileset as a second blockset",
      play: async(map) => {
        await map.panes.open("Paint");
        await map.texture.importBlockset(await writeTileset());
        await expect(map.texture.blocksetTab("placeholder")).toBeVisible();
      },
      expected: kTileset
    },
    {
      id: "shapes",
      title: "duplicate tileset blocks into shallow water, a bridge slab and a slope",
      play: async(map) => {
        const { library } = map.blocks;
        await map.panes.open("Blocks");
        const shapes = [
          ["Water", kShallows, "Bottom slab"],
          ["Planks", kBridge, "Top slab"],
          ["Grass", kSlope, "Ramp"]
        ];
        for (const [source, name, shape] of shapes) {
          await library.choose(source, "Duplicate");
          await library.edit(`${source} copy`);
          const copy = map.blockDialog(`${source} copy`);
          await copy.pickShape(shape);
          await copy.rename(name);
          await map.blockDialog(name).closeButton.click();
          await expect(library.option(name)).toBeVisible();
        }
      },
      expected: kShapes
    },
    {
      id: "hill",
      title: "paint a round island and a hill, then replace a sand path into it",
      play: async(map) => {
        const { viewport } = map;
        await map.useBrush("Grass", 7);
        await map.shortcut("c");
        await repeat(4, () => map.shortcut("BracketRight"));
        await viewport.click({ x: 0, y: 0, z: 0 });
        await expect.poll(() => map.world.voxelCount()).toBe(97);

        await repeat(6, () => map.shortcut("BracketLeft"));
        await viewport.click({ x: -2, y: 1, z: -1 });
        await map.shortcut("c");

        await map.useBrush("Sand", 1);
        await map.shortcut("r");
        await viewport.drag([
          { x: -2, y: 1, z: 3 },
          { x: 1, y: 1, z: 3 },
          { x: 1, y: 1, z: 1 }
        ]);
        await map.shortcut("r");
      },
      expected: kHillShaped
    },
    {
      id: "pond",
      title: "dig a pond with the corner select and fill it with shallow water",
      play: async(map) => {
        const { toolbar, viewport } = map;
        const [first, last] = [kPond.cells("~").at(0)!, kPond.cells("~").at(-1)!];
        await toolbar.selectToolButton.click();
        await toolbar.selectModeButton("Corner select").click();
        await viewport.click(above(first));
        await viewport.click(above(last));
        await map.shortcut("Delete");
        await expect.poll(() => map.world.voxelCount()).toBe(109);

        await map.shortcut("b");
        await map.useBrush(kShallows, 3);
        await viewport.click(kPondCenter);
      },
      expected: kPondDug
    },
    {
      id: "bridge",
      title: "merge a bridge over the water, remove a plank and undo, pick it for a jetty",
      play: async(map) => {
        const { library } = map.blocks;
        const { viewport } = map;
        const [deck, jetty] = [
          kBridged.cells("=").slice(0, 3),
          kBridged.cells("=").at(3)!
        ];
        await map.useBrush(kBridge, 1);
        for (const cell of deck) {
          await viewport.press([slabTop(cell)]);
        }

        await viewport.press([slabTop(deck[1])], { button: "right" });
        await map.shortcut("ControlOrMeta+z");

        await library.select("Grass");
        await viewport.press([slabTop(deck[1])], { modifiers: ["ControlOrMeta"] });
        await viewport.press([slabTop(jetty)]);
      },
      expected: kBridgeBuilt
    },
    {
      id: "signpost",
      title: "turn and flip a compass signpost, then lay slopes around the hill",
      play: async(map) => {
        const { viewport } = map;
        await map.useBrush(kCompass, 1);
        await map.shortcut("e");
        await map.shortcut("v");
        await viewport.click(kCompassFrom);
        await map.shortcut("v");

        await map.useBrush(kSlope, 1);
        await viewport.click(kSignposted.cells(">")[0]);
        await map.shortcut("q");
        await map.shortcut("q");
        await viewport.click(kSignposted.cells("<")[0]);
        await map.shortcut("t");
        await viewport.click(kSignposted.cells("^")[0]);
      },
      expected: kSignpostPlaced
    },
    {
      id: "marquee",
      title: "lift the signpost, turn it and carry it across the bridge; cancel another lift",
      play: async(map) => {
        const { toolbar, viewport, world } = map;
        const before = await world.voxelCount();
        await map.shortcut("m");
        await toolbar.selectModeButton("Box select").click();
        await viewport.click(above(kCompassFrom));
        await expect.poll(() => world.voxelCount()).toBe(before - 1);

        await map.shortcut("e");
        await viewport.drag([above(kCompassFrom), above(kCompassTo)]);
        await map.shortcut("Enter");
        await expect.poll(() => world.voxelCount()).toBe(before);

        await viewport.click(above(kSignposted.cells("^")[0]));
        await expect.poll(() => world.voxelCount()).toBe(before - 1);
        await map.shortcut("Escape");
        await expect.poll(() => world.voxelCount()).toBe(before);
      },
      expected: kSignpostMoved
    },
    {
      id: "forest",
      title: "grow a tree on its own layer, copy it with connected select and plant another",
      play: async(map) => {
        const { toolbar, viewport } = map;
        await map.shortcut("b");
        await map.panes.open("Layers");
        await map.layers.add("Voxel", kTrees);

        await map.useBrush("Wood", 1);
        await viewport.click(kTrunk);
        await viewport.click(above(kTrunk));
        await map.useBrush("Leaves", 3);
        await viewport.click({ ...kTrunk, y: 3 });
        await map.useBrush("Leaves", 1);
        await viewport.click({ ...kTrunk, y: 4 });
        await expect.poll(() => map.world.voxelCount()).toBe(122 + kTreeVoxels);

        await toolbar.selectToolButton.click();
        await toolbar.selectModeButton("Connected select").click();
        await viewport.click({ ...kTrunk, y: 5 });
        await map.shortcut("ControlOrMeta+c");
        await map.shortcut("ControlOrMeta+v", kSapling);
        await map.shortcut("Enter");
      },
      expected: kForested
    }
  ]
}).register();
