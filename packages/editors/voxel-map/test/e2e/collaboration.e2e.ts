// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";

const kCell = {
  x: 0,
  y: 0,
  z: 0
};

test("painted voxels survive a reload", async({ map }) => {
  await map.viewport.pinCamera();
  await map.viewport.click(kCell);
  await expect.poll(() => map.world.blocks([kCell])).toEqual([1]);

  await map.reload();

  await expect.poll(() => map.world.blocks([kCell])).toEqual([1]);
});

test("a peer sees edits and appears among the collaborators", async({ map, peerMap }) => {
  test.slow();
  await expect(map.collaborator("Peer")).toBeVisible();
  await expect(peerMap.collaborator("E2E")).toBeVisible();

  await map.viewport.pinCamera();
  await map.viewport.click(kCell);
  await expect.poll(() => peerMap.world.blocks([kCell])).toEqual([1]);

  await peerMap.viewport.pinCamera();
  await peerMap.viewport.click({ x: 0, y: 1, z: 0 }, "right");
  await expect.poll(() => map.world.blocks([kCell])).toEqual([null]);

  await peerMap.page.context().close();
  await expect(map.collaborator("Peer")).toBeHidden();
});
