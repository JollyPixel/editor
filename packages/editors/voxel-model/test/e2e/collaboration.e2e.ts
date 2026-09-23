// Import Third-party Dependencies
import { treeRow } from "@jolly-pixel/e2e";
import {
  nextFrames,
  waitForEditor
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import { addNode } from "./support/hierarchy.ts";
import {
  blockSummary,
  gizmoHandlePoints,
  outline
} from "./support/scene.ts";

test("the hierarchy and transforms survive a reload", async({ page }) => {
  await addNode(page, "Folder", "Limbs");
  await treeRow(page, "Limbs").click();
  await addNode(page, "Block", "Arm");
  const x = page.getByRole("textbox", { name: "X" });
  await x.fill("2");
  await x.press("Enter");

  await page.reload();
  await waitForEditor(page);

  await expect(treeRow(page, "Arm")).toBeVisible();
  expect(await outline(page)).toEqual(["Limbs/", "  Arm", "Block"]);
  expect(await blockSummary(page, "Arm")).toMatchObject({
    position: { x: 2, y: 0, z: 0 }
  });
});

test("a peer sees edits, selections and appears among the collaborators", async({ page, peer }) => {
  test.slow();
  await expect(page.getByRole("button", { name: "Select Peer" })).toBeVisible();
  await expect(peer.getByRole("button", { name: "Select E2E" })).toBeVisible();

  await test.step("edits", async() => {
    await addNode(page, "Block", "Arm");
    await expect(treeRow(peer, "Arm")).toBeVisible();

    await treeRow(peer, "Arm").dblclick();
    const rename = peer.getByRole("textbox", { name: "Rename" });
    await rename.fill("Leg");
    await rename.press("Enter");
    await expect(treeRow(page, "Leg")).toBeVisible();
  });

  await test.step("selections", async() => {
    await treeRow(peer, "Block").click();
    await expect(treeRow(page, "Block").getByTitle("Peer")).toBeVisible();
  });

  await peer.context().close();
  await expect(page.getByRole("button", { name: "Select Peer" })).toBeHidden();
  await expect(treeRow(page, "Block").getByTitle("Peer")).toBeHidden();
});

test("a block dragged by a peer is locked and follows the drag live", async({ page, peer }) => {
  test.slow();
  await treeRow(page, "Block").click();
  await treeRow(peer, "Block").click();
  const x = page.getByRole("textbox", { name: "X" });
  await expect(x).toBeEnabled();

  const [from, to] = await gizmoHandlePoints(peer, "X");
  await peer.mouse.move(from.x, from.y);
  await nextFrames(peer);
  await peer.mouse.down();
  await peer.mouse.move(to.x, to.y, { steps: 4 });
  await nextFrames(peer);

  await expect(x).toBeDisabled();
  await expect.poll(
    async() => (await blockSummary(page, "Block"))?.position.x
  ).toBeGreaterThan(0.1);

  await peer.mouse.up();
  await nextFrames(peer);

  await expect(x).toBeEnabled();
  const committed = await blockSummary(peer, "Block");
  await expect.poll(() => blockSummary(page, "Block")).toEqual(committed);
});
