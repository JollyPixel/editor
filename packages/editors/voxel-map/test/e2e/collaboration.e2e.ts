// Import Internal Dependencies
import {
  test,
  expect,
  openEditor,
  waitForEditor
} from "./fixtures.ts";
import {
  blocksAt,
  clickCell,
  pinCamera
} from "./support/scene.ts";

const kCell = {
  x: 0,
  y: 0,
  z: 0
};

test("painted voxels survive a reload", async({ page }) => {
  await pinCamera(page);
  await clickCell(page, kCell);
  await expect.poll(() => blocksAt(page, [kCell])).toEqual([1]);

  await page.reload();
  await waitForEditor(page);

  await expect.poll(() => blocksAt(page, [kCell])).toEqual([1]);
});

test("a peer sees edits and appears among the collaborators", async({ page, browser, world }) => {
  const peerContext = await browser.newContext();
  const peer = await peerContext.newPage();

  try {
    await openEditor(peer, world, { username: "Peer" });
    await expect(page.getByRole("button", { name: "Select Peer" })).toBeVisible();
    await expect(peer.getByRole("button", { name: "Select E2E" })).toBeVisible();

    await pinCamera(page);
    await clickCell(page, kCell);
    await expect.poll(() => blocksAt(peer, [kCell])).toEqual([1]);

    await pinCamera(peer);
    await clickCell(peer, { x: 0, y: 1, z: 0 }, "right");
    await expect.poll(() => blocksAt(page, [kCell])).toEqual([null]);
  }
  finally {
    await peerContext.close();
  }

  await expect(page.getByRole("button", { name: "Select Peer" })).toBeHidden();
});
