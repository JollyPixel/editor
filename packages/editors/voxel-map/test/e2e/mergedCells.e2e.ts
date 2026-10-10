// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kSlabBottom = 2;
const kSlabTop = 3;
const kOtherSlabTop = 4;
const kCell = { x: 0, y: 0, z: 0 };
const kUpperHalf = { x: 0, y: 1, z: 0 };
const kUpperHalfTop = { x: 0.5, y: 1, z: 0.5 };
const kLowerHalfFront = { x: 0.5, y: 0.25, z: 1 };

async function defineSlabs(
  map: VoxelMapPage
): Promise<void> {
  await map.page.evaluate((slabs) => {
    const { workspace } = window.voxelMapEditor!;
    for (const [id, shapeId] of slabs) {
      workspace.blocksets.defineBlock({
        ...workspace.view.document.blocks.get(id)!,
        shapeId
      });
    }
  }, [
    [kSlabBottom, "slabBottom"],
    [kSlabTop, "slabTop"],
    [kOtherSlabTop, "slabTop"]
  ] as const);
}

async function seedSlabPair(
  map: VoxelMapPage
): Promise<void> {
  await defineSlabs(map);
  await map.page.evaluate((args) => {
    const { world } = window.voxelMapEditor!.workspace.view.document;
    world.setVoxel("Ground", { position: args.cell, blockId: args.bottom });
    world.setVoxel("Ground", {
      position: args.cell,
      blockId: args.top,
      merge: true
    });
  }, {
    cell: kCell,
    bottom: kSlabBottom,
    top: kSlabTop
  });
}

function cellParts(
  map: VoxelMapPage
): Promise<Array<number | null>> {
  return map.page.evaluate((cell) => {
    const { world } = window.voxelMapEditor!.workspace.view.document;
    const entry = world.getVoxelAt(cell);

    return [entry?.blockId ?? null, entry?.partner?.blockId ?? null];
  }, kCell);
}

function removalSpan(
  map: VoxelMapPage
) {
  return map.page.evaluate(() => {
    const { localBrush } = window.voxelMapEditor!.workspace;
    const ghost = localBrush.actor.object3D.getObjectByName("removal-ghost");
    const mesh = ghost?.children[0] as { geometry?: any; } | undefined;
    if (!ghost?.visible || mesh?.geometry === undefined) {
      return null;
    }

    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox;

    return [min.y, max.y].map((local: number) => {
      const height = ghost.position.y + (ghost.scale.y * (local - 0.5));

      return (Math.round(height * 10) / 10) + 0;
    });
  });
}

test.beforeEach(async({ map }) => {
  await map.viewport.pinCamera();
});

test("a click on a half block merges its complement into the same cell", async({ map }) => {
  const { brush, viewport } = map;
  await defineSlabs(map);
  await map.world.seed([{ ...kCell, blockId: kSlabBottom }]);
  await brush.change({ blockId: kSlabTop });
  const slabTop = { x: 0, y: 0.5, z: 0 };

  await test.step("the ghost previews the merge inside the cell", async() => {
    await map.toolbar.ghostButton.click();
    await viewport.hover(slabTop);
    await expect.poll(() => brush.ghost()).toEqual({
      visible: true,
      position: [0.5, 0.5, 0.5]
    });
  });

  await test.step("a click merges the two halves into one voxel", async() => {
    await viewport.click(slabTop);
    await expect.poll(() => cellParts(map)).toEqual([kSlabBottom, kSlabTop]);
    expect(await map.world.voxelCount()).toBe(1);
  });
});

test("a right click removes the aimed half and undo brings it back", async({ map, page }) => {
  const { viewport } = map;
  await seedSlabPair(map);

  await test.step("the cursor outlines the aimed half", async() => {
    await viewport.hoverPoint(kLowerHalfFront);
    await expect.poll(() => removalSpan(map)).toEqual([0, 0.5]);
    await viewport.hoverPoint(kUpperHalfTop);
    await expect.poll(() => removalSpan(map)).toEqual([0.5, 1]);
  });

  await test.step("the right click keeps the other half", async() => {
    await viewport.click(kUpperHalf, "right");
    await expect.poll(() => cellParts(map)).toEqual([kSlabBottom, null]);
    await expect.poll(() => removalSpan(map)).toBeNull();
  });

  await test.step("undo restores the pair", async() => {
    await page.keyboard.press("Control+KeyZ");
    await expect.poll(() => cellParts(map)).toEqual([kSlabBottom, kSlabTop]);
  });
});

test("Ctrl+click picks the half under the cursor", async({ map }) => {
  const { brush, viewport } = map;
  await seedSlabPair(map);
  await brush.change({ blockId: 1 });

  await viewport.pick(kUpperHalfTop);
  await expect.poll(async() => (await brush.state()).blockId).toBe(kSlabTop);

  await viewport.pick(kLowerHalfFront);
  await expect.poll(async() => (await brush.state()).blockId).toBe(kSlabBottom);
});

test("replace mode repaints only the aimed half", async({ map, page }) => {
  const { brush } = map;
  await seedSlabPair(map);
  await brush.change({ blockId: kOtherSlabTop });
  await page.keyboard.press("KeyR");
  await expect.poll(async() => (await brush.state()).mode).toBe("replace");

  await map.viewport.click(kUpperHalf);

  await expect.poll(() => cellParts(map)).toEqual([kSlabBottom, kOtherSlabTop]);
  expect(await map.world.voxelCount()).toBe(1);
});
