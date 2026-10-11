// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";
import { DEFAULT_BLOCKSET_ID } from "../../src/boot/defaultSeed.ts";

function finishOf(
  map: VoxelMapPage,
  groupId: string
): Promise<{ roughness: number; swatch: string | null; } | null> {
  return map.page.evaluate((id) => {
    const group = window.voxelMapEditor!.workspace.mapDocument.materialGroups.get(id);

    return group === undefined ?
      null :
      {
        roughness: group.roughness,
        swatch: group.swatch
      };
  }, groupId);
}

function blocksOf(
  map: VoxelMapPage
): Promise<{ id: number; name: string; }[]> {
  return map.page.evaluate(() => [
    ...window.voxelMapEditor!.workspace.mapDocument.blocks.getAll()
  ].slice(0, 2).map((block) => {
    return { id: block.id, name: block.name };
  }));
}

function materialOf(
  map: VoxelMapPage,
  blockId: number
): Promise<string | undefined> {
  return map.page.evaluate(
    (id) => window.voxelMapEditor!.workspace.mapDocument.blocks.get(id)?.materialGroup,
    blockId
  );
}

test("a material made in the Materials pane is renamed, applied, recoloured and edited", async({ map }) => {
  const { materials } = map;
  const { library } = materials;
  await map.panes.open("Materials");
  const [first, second] = await blocksOf(map);

  await library.select(first.name);
  await materials.create("Gold");
  const goldId = `${DEFAULT_BLOCKSET_ID}/Gold`;
  await expect.poll(() => finishOf(map, goldId)).not.toBeNull();
  expect(await materialOf(map, first.id)).toBeUndefined();

  await materials.applyButton.click();
  await expect.poll(() => materialOf(map, first.id)).toBe(goldId);

  await library.select(second.name);
  await expect(materials.selected).toHaveText("Gold");
  await materials.applyButton.click();
  await expect.poll(() => materialOf(map, second.id)).toBe(goldId);

  const firstSquare = library.swatch(first.id);
  await expect(firstSquare).toBeVisible();
  await expect(library.swatch(second.id))
    .toHaveAttribute("style", (await firstSquare.getAttribute("style"))!);

  await materials.changeColor("#ff0000");
  await expect.poll(async() => (await finishOf(map, goldId))?.swatch).toBe("#ff0000");
  await expect(firstSquare).toHaveAttribute("style", /background:#ff0000/);

  await materials.changeRoughness(0);
  await expect.poll(async() => (await finishOf(map, goldId))?.roughness).toBe(0);

  await map.panes.open("Blocks");
  await expect(map.blocks.library.swatch(first.id)).toBeVisible();
});

test("the material fields follow the block picked in the library", async({ map }) => {
  const { materials } = map;
  await map.panes.open("Materials");
  const [first, second] = await blocksOf(map);
  await map.page.evaluate(([firstId, secondId]) => {
    const { blocksets, mapDocument } = window.voxelMapEditor!.workspace;
    for (const [blockId, name] of [[firstId, "Gold"], [secondId, "Silver"]] as const) {
      const block = mapDocument.blocks.get(blockId)!;
      const groupId = blocksets.findOwner(blockId)!.slot.qualifyGroupId(name);
      blocksets.defineBlock({ ...block, materialGroup: groupId });
    }
  }, [first.id, second.id]);

  await materials.library.select(first.name);
  await expect(materials.selected).toHaveText("Gold");
  await materials.library.select(second.name);
  await expect(materials.selected).toHaveText("Silver");
  await expect(materials.removeButton).toBeVisible();
});

test("the Materials tab is disabled while the map has no blocks", async({ map }) => {
  const tab = map.panes.tab("Materials");
  await expect(tab).toBeEnabled();

  await map.page.evaluate(() => {
    const { workspace } = window.voxelMapEditor!;
    for (const block of [...workspace.mapDocument.blocks.getAll()]) {
      workspace.blocksets.removeBlock(block.id);
    }
  });

  await expect(tab).toBeDisabled();
});
