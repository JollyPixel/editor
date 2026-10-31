// Import Third-party Dependencies
import { expect } from "@playwright/test";

// Import Internal Dependencies
import { Scenario } from "./support/Scenario.ts";
import type {
  MapBlock,
  MapCell,
  MapExpectation
} from "./support/MapArchive.ts";
import type { Cell } from "./support/viewport.ts";

// CONSTANTS
const kStone = "Stone";
const kNewBlock = "New Block";
const kRoof = "Roof";
const kGold = "Gold";
const kGoldSwatch = "#d4a017";
const kRow = [-1, 0, 1];
const kFloor = square(0, 0);
const kWall: Cell[] = kRow.map((x) => {
  return { x, y: 1, z: -1 };
});
const kRoofCells = square(2, -1);
const kStoneBlock: MapBlock = {
  name: kStone,
  tile: "full",
  material: null
};
const kPaintedBlock: MapBlock = {
  name: kNewBlock,
  tile: "full",
  material: null
};

const kBlank: MapExpectation = {
  layers: [{ name: "Ground", voxels: 0 }],
  templates: [],
  blocks: [kStoneBlock],
  materials: [],
  paintedTiles: 1,
  voxelCount: 0,
  cells: filled(kFloor, null)
};
const kFirstBlock: MapExpectation = {
  ...kBlank,
  blocks: [kStoneBlock, kPaintedBlock],
  paintedTiles: 2
};
const kFloorLaid: MapExpectation = {
  ...kFirstBlock,
  layers: [{ name: "Ground", voxels: 9 }],
  voxelCount: 9,
  cells: filled(kFloor, kNewBlock)
};
const kWallBuilt: MapExpectation = {
  ...kFloorLaid,
  layers: [{ name: "Ground", voxels: 12 }],
  voxelCount: 12,
  cells: [
    ...filled(kFloor, kNewBlock),
    ...filled(kWall, kNewBlock)
  ]
};
const kRoofBuilt: MapExpectation = {
  ...kWallBuilt,
  layers: [
    { name: kRoof, voxels: 9 },
    { name: "Ground", voxels: 12 }
  ],
  voxelCount: 21,
  cells: [
    ...kWallBuilt.cells,
    ...filled(kRoofCells, kStone)
  ]
};
const kRoofCopied: MapExpectation = {
  ...kRoofBuilt,
  layers: [
    { name: kRoof, voxels: 18 },
    { name: "Ground", voxels: 12 }
  ],
  templates: [kRoof],
  voxelCount: 30
};
const kGilded: MapExpectation = {
  ...kRoofCopied,
  blocks: [kStoneBlock, { ...kPaintedBlock, material: kGold }],
  materials: [{ id: kGold, swatch: kGoldSwatch }]
};

function square(
  y: number,
  z: number
): Cell[] {
  return kRow.flatMap(
    (x) => kRow.map((dz) => {
      return { x, y, z: z + dz };
    })
  );
}

function filled(
  cells: Cell[],
  block: string | null
): MapCell[] {
  return cells.map((cell) => {
    return { ...cell, block };
  });
}

new Scenario({
  id: "build-house",
  title: "build a small house from a blank map",
  chapters: [
    {
      id: "blank",
      title: "the blank map has one layer and the starter block",
      play: () => Promise.resolve(),
      expected: kBlank
    },
    {
      id: "first-block",
      title: "create a block and fill its tile",
      play: async(map) => {
        await map.panes.open("Blocks");
        await map.blocks.library.addButton.click();
        await map.blockDialog(kNewBlock).createButton.click();
        await expect(map.blocks.library.option(kNewBlock)).toBeVisible();

        await map.panes.open("Paint");
        await map.texture.pickModeOption("Fill", "Clip to UV");
        const center = await map.texture.blockTileCenter(kNewBlock);
        await map.texture.clickTexel(center);
        await expect.poll(() => map.texture.pixelAlpha(center)).toBe(255);
      },
      expected: kFirstBlock
    },
    {
      id: "floor",
      title: "lay a 3x3 floor in one click",
      play: async(map) => {
        await map.useBrush(kNewBlock, 3);
        await map.viewport.click({ x: 0, y: 0, z: 0 });
      },
      expected: kFloorLaid
    },
    {
      id: "wall",
      title: "draw a wall, undo it and redo it",
      play: async(map) => {
        await map.useBrush(kNewBlock, 1);
        await map.viewport.drag(kWall);
        await expect.poll(() => map.world.voxelCount()).toBe(12);
        await map.toolbar.undoButton.click();
        await expect.poll(() => map.world.voxelCount()).toBe(9);
        await map.toolbar.redoButton.click();
      },
      expected: kWallBuilt
    },
    {
      id: "roof-layer",
      title: "add a Roof layer and build on top of the wall",
      play: async(map) => {
        await map.panes.open("Layers");
        await map.layers.add("Voxel", kRoof);
        await expect(map.layers.row(kRoof)).toHaveAttribute("aria-selected", "true");

        await map.useBrush(kStone, 3);
        await map.viewport.click({ x: 0, y: 2, z: -1 });
      },
      expected: kRoofBuilt
    },
    {
      id: "template",
      title: "save the Roof layer as a template and place a copy",
      play: async(map) => {
        await map.panes.open("Layers");
        await map.layers.saveAsTemplate(kRoof);
        await expect(map.templates.row).toHaveAttribute("aria-selected", "true");

        await map.viewport.pinCamera();
        await map.templates.dragTo({ x: 5, y: 0, z: 0 });
        await map.toolbar.commitButton(kRoof).click();
      },
      expected: kRoofCopied
    },
    {
      id: "material",
      title: "give the painted block a gold material",
      play: async(map) => {
        const { materials } = map;
        await map.panes.open("Materials");
        await materials.library.select(kNewBlock);
        await materials.create(kGold);
        await materials.applyButton.click();
        await materials.changeColor(kGoldSwatch);
      },
      expected: kGilded
    },
    {
      id: "reload",
      title: "the house survives a page reload",
      play: (map) => map.reload(),
      expected: kGilded
    },
    {
      id: "round-trip",
      title: "export, wipe the offline data and import the house back",
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
