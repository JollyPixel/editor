// Import Third-party Dependencies
import {
  dialog,
  treeRow
} from "@jolly-pixel/e2e";
import {
  nextFrames,
  waitForEditor
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  addNode,
  dragMaterialSlider,
  hierarchyAction,
  materialRow,
  materialTab,
  newMaterial,
  openMaterial,
  openMaterialTab,
  rowMenu
} from "./support/hierarchy.ts";
import {
  blockSummary,
  blockSurface,
  gizmoHandlePoints,
  materialOutline,
  outline
} from "./support/scene.ts";
import { historyButton } from "./support/history.ts";

test("the hierarchy and transforms survive a reload", async({ page, peer }) => {
  test.slow();
  await addNode(page, "Folder", "Limbs");
  await addNode(page, "Block", "Arm", { under: "Limbs" });
  const x = page.getByRole("textbox", { name: "X" });
  await x.fill("2");
  await x.press("Enter");
  await openMaterial(page, "Arm");
  await newMaterial(page, "Metal");
  await expect.poll(() => blockSurface(peer, "Arm"))
    .toMatchObject({ metalness: 0.8 });

  await page.reload();
  await waitForEditor(page);

  await expect(treeRow(page, "Arm")).toBeVisible();
  expect(await outline(page)).toEqual(["Block", "Limbs/", "  Arm"]);
  expect(await blockSummary(page, "Arm")).toMatchObject({
    position: { x: 2, y: 0, z: 0 }
  });
  expect(await blockSurface(page, "Arm")).toMatchObject({ metalness: 0.8 });
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

test("a peer sees who edits a material and the materials added", async({ page, peer }) => {
  test.slow();
  await openMaterial(page, "Block");
  await newMaterial(page, "Metal");
  await openMaterialTab(peer);

  await expect(materialRow(peer, "Metal").getByTitle("E2E")).toBeVisible();

  await newMaterial(page, "Glass");

  await expect.poll(() => materialOutline(peer)).toEqual(["Metal", "Glass"]);
  await expect(materialRow(peer, "Glass").getByTitle("E2E")).toBeVisible();
  await expect(materialRow(peer, "Metal").getByTitle("E2E")).toBeHidden();
});

test("a material field a peer holds is locked, and other fields' edits survive", async({ page, peer }) => {
  test.slow();
  await openMaterial(page, "Block");
  await newMaterial(page, "Material");
  await openMaterialTab(peer);
  await materialRow(peer, "Material").click();

  const roughness = materialTab(page).getByRole("slider", { name: "Roughness" });
  await materialTab(peer).getByRole("slider", { name: "Roughness" }).focus();
  await expect(roughness).toBeDisabled();
  await expect(roughness).toHaveAttribute("aria-description", "Held by Peer");

  await dragMaterialSlider(page, "Metalness", 0.8);
  await dragMaterialSlider(peer, "Roughness", 0.2);

  for (const viewer of [page, peer]) {
    await expect.poll(async() => {
      const surface = await blockSurface(viewer, "Block", "document");

      return surface !== null && surface.metalness > 0.5 && surface.roughness < 0.5;
    }).toBe(true);
  }

  await materialTab(peer).getByRole("slider", { name: "Roughness" }).blur();
  await expect(roughness).toBeEnabled();
});

test("a peer sees a material slider and its blocks follow a drag live", async({ page, peer }) => {
  test.slow();
  await openMaterial(page, "Block");
  await newMaterial(page, "Material");
  await openMaterialTab(peer);
  await materialRow(peer, "Material").click();
  const peerSlider = materialTab(peer).getByRole("slider", { name: "Metalness" });

  const box = (await materialTab(page).getByRole("slider", { name: "Metalness" }).boundingBox())!;
  const y = box.y + (box.height / 2);
  await page.mouse.move(box.x + 1, y);
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width * 0.8), y, { steps: 4 });

  await expect.poll(async() => (await blockSurface(peer, "Block"))?.metalness ?? 0)
    .toBeGreaterThan(0.5);
  await expect.poll(async() => Number(await peerSlider.inputValue())).toBeGreaterThan(0.5);
  expect((await blockSurface(peer, "Block", "document"))?.metalness).toBe(0);

  await page.mouse.up();
  const seen: number[] = [];
  const until = Date.now() + 1500;
  while (Date.now() < until) {
    seen.push(Number(await peerSlider.inputValue()));
  }

  expect(Math.min(...seen)).toBeGreaterThan(0.5);
  await expect.poll(async() => (await blockSurface(peer, "Block", "document"))?.metalness ?? 0)
    .toBeGreaterThan(0.5);
  expect(await blockSurface(peer, "Block")).toEqual(await blockSurface(peer, "Block", "document"));
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

test("a row menu action on a row a peer deleted does nothing", async({ page, peer }) => {
  test.slow();
  await addNode(page, "Block", "Arm");
  await expect(treeRow(peer, "Arm")).toBeVisible();
  const menu = await rowMenu(page, "Arm");

  await treeRow(peer, "Arm").click();
  await hierarchyAction(peer, "Delete").click();
  await dialog(peer, "Delete Block").getByRole("button", { name: "Delete" }).click();
  await expect(treeRow(page, "Arm")).toHaveCount(0);

  await menu.getByRole("menuitem", { name: "Delete" }).click();

  await expect(menu).toBeHidden();
  await expect(dialog(page, "Delete Block")).toHaveCount(0);
  expect(await outline(page)).toEqual(["Block"]);
});

test("a peer renaming the block again refuses this rename, listed with their name", async({ page, peer }) => {
  test.slow();
  await treeRow(page, "Block").dblclick();
  const rename = page.getByRole("textbox", { name: "Rename" });
  await rename.fill("Torso");
  await rename.press("Enter");
  await expect(treeRow(peer, "Torso")).toBeVisible();

  await treeRow(peer, "Torso").dblclick();
  const peerRename = peer.getByRole("textbox", { name: "Rename" });
  await peerRename.fill("Chest");
  await peerRename.press("Enter");
  await expect(treeRow(page, "Chest")).toBeVisible();

  await expect(historyButton(page, "Undo").getByRole("button")).toBeDisabled();
  await historyButton(page, "Refused steps").getByRole("button").click();
  await expect(page.getByRole("dialog", { name: "Refused steps" }))
    .toContainText("Rename Block: Peer changed it since");
});
