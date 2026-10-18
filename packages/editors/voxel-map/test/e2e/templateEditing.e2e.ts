// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

test("two peers edit one template, apply it and leave the map untouched", async({ map, peerMap }) => {
  test.slow();
  const { templates } = map;
  await map.panes.open("Layers");
  await map.world.seed([{ ...kOrigin, blockId: 1 }]);
  await templates.saveLayer();
  await peerMap.panes.open("Layers");
  await expect(peerMap.templates.row).toHaveCount(1);

  await templates.edit(templates.row);
  await expect(templates.editBar).toContainText("Editing Ground");
  await peerMap.templates.edit(peerMap.templates.row);
  await expect(peerMap.templates.editBar).toBeVisible();

  await map.viewport.pinCamera();
  await map.viewport.click(kOrigin);
  await expect.poll(() => peerMap.templates.draftVoxelCount()).toBe(2);

  await templates.applyEdits();
  await expect.poll(() => peerMap.templates.voxelCounts()).toEqual([2]);

  await templates.finishEditing();
  await expect(templates.editBar).toBeHidden();
  expect(await map.world.blocks([kOrigin, { x: 0, y: 1, z: 0 }])).toEqual([1, null]);
  expect(await templates.draftVoxelCount()).toBe(2);

  await expect.poll(() => peerMap.templates.peerInDraft()).toBe(false);
  await peerMap.templates.finishEditing();
  await expect.poll(() => templates.draftVoxelCount()).toBeNull();
});
