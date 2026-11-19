// Import Third-party Dependencies
import { expect } from "@playwright/test";
import { Scenario } from "@jolly-pixel/e2e/scenario";

// Import Internal Dependencies
import {
  Blueprint,
  part,
  voxel,
  type Drawing,
  type Levels
} from "./support/Blueprint.ts";
import {
  MapArchive,
  type MapBlock,
  type MapLayer,
  type MapMaterial
} from "./support/MapArchive.ts";
import {
  TILESET_BLOCKS,
  writeTileset
} from "./support/tileset.ts";
import {
  cameraAbove,
  frontFace,
  type Cell
} from "./support/viewport.ts";
import { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kCamera = cameraAbove({ x: 4, y: 0, z: 0.5 }, 12, 12);
const kNewBlock = "New Block";
const kDoor = "Door";
const kGold = "Gold";
const kGoldSwatch = "#d4a017";
const kRoof = "Roof";
const kGround = "Ground";
const kHouse = "House";
const kStreetOffset = 8;

const kSite = Blueprint.site({
  west: -2,
  north: -2,
  width: 13,
  depth: 5,
  legend: {
    C: "Cobble",
    P: "Planks",
    W: "Plaster",
    N: "Window",
    D: kDoor,
    R: voxel(part("Roof", { rotation: 0 })),
    "^": "Roof slope",
    v: voxel(part("Roof slope", { rotation: 0 }))
  }
});
const kFoundation = kSite.with({
  0: [
    "CCCCC",
    "CPPPC",
    "CPPPC",
    "CPPPC",
    "CCCCC"
  ]
});
const kWalls = kFoundation.with({
  1: [
    "WWWWW",
    "W...W",
    "W...W",
    "W...W",
    "WWWWW"
  ],
  2: [
    "WWWWW",
    "W...W",
    "W...W",
    "W...W",
    "WWWWW"
  ]
});
const kOpenings = kWalls.with({
  1: [
    "",
    "",
    "",
    "",
    "  D"
  ],
  2: [
    "",
    "",
    "N   N",
    "",
    " NDN"
  ]
});
const kRoofLevels: Levels = {
  3: [
    "vvvvv",
    "RRRRR",
    "RRRRR",
    "RRRRR",
    "^^^^^"
  ],
  4: [
    "",
    "vvvvv",
    "RRRRR",
    "^^^^^"
  ]
};
const kRoofed = kOpenings.with(kRoofLevels);
const kStreet = kRoofed.withCopy(kStreetOffset);
const kHouseVoxels = 97;
const kRoofVoxels = 40;

const kStarterBlock: MapBlock = {
  name: "Stone",
  shape: "cube",
  tile: "full",
  material: null
};
const kDoorBlock: MapBlock = {
  name: kDoor,
  shape: "cube",
  tile: "full",
  material: null
};

interface HouseExpectation {
  layers: MapLayer[];
  templates: string[];
  imported: number;
  blocks: MapBlock[];
  materials: MapMaterial[];
  drawing: Drawing;
  strays: string[];
}

const kBlank: HouseExpectation = {
  layers: [{ name: kGround, voxels: 0 }],
  templates: [],
  imported: 0,
  blocks: [kStarterBlock],
  materials: [],
  drawing: {},
  strays: []
};
const kDoorPainted: HouseExpectation = {
  ...kBlank,
  blocks: [kStarterBlock, kDoorBlock]
};
const kTileset: HouseExpectation = {
  ...kDoorPainted,
  imported: TILESET_BLOCKS.length
};
const kFoundationLaid: HouseExpectation = {
  ...kTileset,
  layers: [{ name: kGround, voxels: 25 }],
  drawing: kFoundation.drawing()
};
const kWallsBuilt: HouseExpectation = {
  ...kFoundationLaid,
  layers: [{ name: kGround, voxels: 57 }],
  drawing: kWalls.drawing()
};
const kOpened: HouseExpectation = {
  ...kWallsBuilt,
  drawing: kOpenings.drawing()
};
const kRoofBuilt: HouseExpectation = {
  ...kOpened,
  layers: [
    { name: kRoof, voxels: kRoofVoxels },
    { name: kGround, voxels: kHouseVoxels - kRoofVoxels }
  ],
  drawing: kRoofed.drawing()
};
const kStreetBuilt: HouseExpectation = {
  ...kRoofBuilt,
  layers: [{ name: kGround, voxels: kHouseVoxels * 2 }],
  templates: [kHouse],
  drawing: kStreet.drawing()
};
const kGilded: HouseExpectation = {
  ...kStreetBuilt,
  blocks: [kStarterBlock, { ...kDoorBlock, material: kGold }],
  materials: [{ id: kGold, swatch: kGoldSwatch }]
};

function row(
  y: number,
  z: number,
  from: number,
  to: number
): Cell[] {
  return [
    { x: from, y, z },
    { x: to, y, z }
  ];
}

function above(
  cell: Cell
): Cell {
  return { ...cell, y: cell.y + 1 };
}

new Scenario<VoxelMapPage, HouseExpectation>({
  id: "build-house",
  title: "build a street of two houses from a blank map",
  open: async(page) => {
    const map = new VoxelMapPage(page);
    await map.openOffline();

    return map;
  },
  ready: (map) => map.viewport.pinCamera(kCamera),
  describe: (archive) => {
    const map = new MapArchive(archive);
    const blocks = map.blocks();
    const { drawing, strays } = kSite.survey(map.voxels());

    return {
      layers: map.layers(),
      templates: map.templates(),
      imported: blocks.filter(
        (block) => TILESET_BLOCKS.includes(block.name)
      ).length,
      blocks: blocks.filter(
        (block) => !TILESET_BLOCKS.includes(block.name)
      ),
      materials: map.materials(),
      drawing,
      strays
    };
  },
  chapters: [
    {
      id: "blank",
      title: "the blank map has one layer and the starter block",
      play: () => Promise.resolve(),
      expected: kBlank
    },
    {
      id: "door",
      title: "create a Door block and fill its tile",
      play: async(map) => {
        const { library } = map.blocks;
        await map.panes.open("Blocks");
        await library.addButton.click();
        await map.blockDialog(kNewBlock).createButton.click();
        await library.edit(kNewBlock);
        await map.blockDialog(kNewBlock).rename(kDoor);
        await map.blockDialog(kDoor).closeButton.click();
        await expect(library.option(kDoor)).toBeVisible();

        await map.panes.open("Paint");
        await map.texture.pickModeOption("Fill", "Clip to UV");
        const center = await map.texture.blockTileCenter(kDoor);
        await map.texture.clickTexel(center);
        await expect.poll(() => map.texture.pixelAlpha(center)).toBe(255);
      },
      expected: kDoorPainted
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
      id: "foundation",
      title: "lay a cobble foundation, then replace its middle with planks",
      play: async(map) => {
        await map.useBrush("Cobble", 5);
        await map.viewport.click({ x: 0, y: 0, z: 0 });

        await map.useBrush("Planks", 3);
        await map.shortcut("r");
        await map.viewport.click({ x: 0, y: 1, z: 0 });
        await map.shortcut("r");
      },
      expected: kFoundationLaid
    },
    {
      id: "walls",
      title: "raise two courses of walls, undo the last stroke and redo it",
      play: async(map) => {
        await map.useBrush("Plaster", 1);
        for (const y of [1, 2]) {
          await map.viewport.drag([
            { x: -2, y, z: -2 },
            { x: 2, y, z: -2 },
            { x: 2, y, z: 2 }
          ]);
          await map.viewport.drag([
            { x: -2, y, z: -1 },
            { x: -2, y, z: 2 },
            { x: 1, y, z: 2 }
          ]);
        }
        await expect.poll(() => map.world.voxelCount()).toBe(57);

        await map.toolbar.undoButton.click();
        await expect.poll(() => map.world.voxelCount()).toBe(50);
        await map.toolbar.redoButton.click();
      },
      expected: kWallsBuilt
    },
    {
      id: "openings",
      title: "swap wall blocks for windows and knock out a door",
      play: async(map) => {
        const { viewport } = map;
        await map.useBrush("Window", 1);
        await map.shortcut("r");
        for (const cell of kOpenings.cells("N")) {
          await viewport.click(above(cell));
        }
        await map.shortcut("r");

        const doorway = kOpenings.cells("D").sort((a, b) => b.y - a.y);
        for (const cell of doorway) {
          await viewport.click(above(cell), { button: "right" });
        }
        await map.useBrush(kDoor, 1);
        for (const cell of doorway.reverse()) {
          await viewport.click(cell);
        }
      },
      expected: kOpened
    },
    {
      id: "roof",
      title: "add a Roof layer and build a gable roof with ramps",
      play: async(map) => {
        const { viewport } = map;
        await map.panes.open("Layers");
        await map.layers.add("Voxel", kRoof);
        await expect(map.layers.row(kRoof)).toHaveAttribute("aria-selected", "true");

        await map.useBrush("Roof slope", 1);
        await map.shortcut("e");
        await map.shortcut("e");
        await viewport.drag(row(3, -2, -2, 2));

        await map.useBrush("Roof", 1);
        for (const z of [-2, -1, 0]) {
          await viewport.press(row(3, z, -2, 2).map(frontFace));
        }
        await map.useBrush("Roof slope", 1);
        await viewport.drag(row(4, -1, -2, 2));
        await map.useBrush("Roof", 1);
        await viewport.drag(row(4, 0, -2, 2));

        await map.useBrush("Roof slope", 1);
        await map.shortcut("t");
        await viewport.drag(row(3, 2, -2, 2));
        await viewport.drag(row(4, 1, -2, 2));
      },
      expected: kRoofBuilt
    },
    {
      id: "street",
      title: "merge the roof down, save the house as a template, place a neighbour",
      play: async(map) => {
        const { layers } = map;
        await map.panes.open("Layers");
        await layers.mergeInto(kRoof, kGround);
        await expect(layers.row(kRoof)).toHaveCount(0);
        await layers.saveAsTemplate(kGround);
        await expect(map.templates.row).toHaveAttribute("aria-selected", "true");
        await map.templates.rename(kHouse);

        await map.viewport.pinCamera(kCamera);
        await map.templates.dragTo({ x: kStreetOffset, y: 0, z: 0 });
        await map.toolbar.commitButton(kGround).click();
      },
      expected: kStreetBuilt
    },
    {
      id: "material",
      title: "give the door a gold material",
      play: async(map) => {
        const { materials } = map;
        await map.panes.open("Materials");
        await materials.library.select(kDoor);
        await materials.create(kGold);
        await materials.applyButton.click();
        await materials.changeColor(kGoldSwatch);
      },
      expected: kGilded
    },
    {
      id: "reload",
      title: "the street survives a page reload",
      play: (map) => map.reload(),
      expected: kGilded
    },
    {
      id: "round-trip",
      title: "export, wipe the offline data and import the street back",
      play: async(map) => {
        const download = await map.archives.exportArchive();
        const archivePath = await download.path();

        await map.archives.resetOfflineData();
        await map.archives.importArchive(archivePath);
      },
      expected: kGilded
    }
  ]
}).register();
