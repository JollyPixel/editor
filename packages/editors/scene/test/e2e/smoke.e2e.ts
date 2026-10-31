// Import Third-party Dependencies
import {
  dialog,
  textField,
  treeRow
} from "@jolly-pixel/e2e";
import {
  nextFrames,
  pressAt
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  addActor,
  addComponent,
  editTransform,
  hierarchy,
  inspectedActor,
  inspector,
  sceneTool,
  transformAxis
} from "./support/panels.ts";
import {
  actorPoint,
  findActor,
  gizmoHandlePoints
} from "./support/scene.ts";

test("opens the scene with its camera and lights", async({ page }) => {
  const rows = hierarchy(page).getByRole("treeitem");

  await expect(rows).toHaveCount(3);
  await expect(rows).toContainText(["Main Camera", "Sun", "Sky"]);
});

test("the inspector edits the actor added from the hierarchy", async({ page }) => {
  await addActor(page, ["Primitive", "Box"]);

  await expect(treeRow(page, "Box")).toHaveAttribute("aria-selected", "true");
  const name = textField(inspectedActor(page), "Name");
  await expect(inspectedActor(page)).toHaveAttribute("label", "Box");
  await expect(name).toHaveValue("Box");
  await expect(inspector(page).locator("jolly-folder[label=\"Mesh\"]")).toBeVisible();

  await name.fill("Crate");
  await name.press("Enter");
  await expect(treeRow(page, "Crate")).toHaveAttribute("aria-selected", "true");
  await expect(inspectedActor(page)).toHaveAttribute("label", "Crate");

  await editTransform(page, "Scale", "Y", "2");
  await expect.poll(async() => (await findActor(page, "Crate"))?.transform.scale)
    .toEqual({ x: 1, y: 2, z: 1 });

  const visible = inspectedActor(page).getByRole("checkbox", { name: "Visible" });
  await expect(visible).toBeChecked();
  await inspectedActor(page).locator("jolly-toggle[label=\"Visible\"]").click();
  await expect(visible).not.toBeChecked();
  await expect.poll(async() => (await findActor(page, "Crate"))?.visible)
    .toBe(false);
});

test("the toolbar undoes and redoes the actor added from the hierarchy", async({ page }) => {
  const undo = sceneTool(page, "undo");
  const redo = sceneTool(page, "redo");
  await expect(undo).toHaveAttribute("disabled");

  await addActor(page, ["Primitive", "Box"]);
  await expect(treeRow(page, "Box")).toBeVisible();

  await undo.click();
  await expect(treeRow(page, "Box")).toHaveCount(0);
  await expect(undo).toHaveAttribute("disabled");

  await redo.click();
  await expect(treeRow(page, "Box")).toBeVisible();
  await expect(redo).toHaveAttribute("disabled");
});

test("a click in the viewport selects an actor and the gizmo moves it in one undo step", async({ page }) => {
  test.slow();
  await addActor(page, ["Primitive", "Box"]);
  await treeRow(page, "Main Camera").click();
  await expect(treeRow(page, "Box")).toHaveAttribute("aria-selected", "false");

  await pressAt(page, [await actorPoint(page, "Box", { x: 0, y: -0.3, z: 0.4 })]);
  await expect(treeRow(page, "Box")).toHaveAttribute("aria-selected", "true");

  const [grab, release] = await gizmoHandlePoints(page, "x");
  await page.mouse.move(grab.x, grab.y);
  await nextFrames(page);
  await page.mouse.down();
  await page.mouse.move(release.x, release.y, { steps: 4 });
  await expect.poll(async() => Number(await transformAxis(page, "X").inputValue()))
    .toBeGreaterThan(0.5);
  expect((await findActor(page, "Box"))?.transform.position.x).toBe(0);

  await page.mouse.up();
  await expect.poll(async() => (await findActor(page, "Box"))?.transform.position.x)
    .toBeGreaterThan(0.5);
  const moved = await findActor(page, "Box");
  expect(moved?.transform.position).toMatchObject({ y: 0, z: 0 });

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async() => (await findActor(page, "Box"))?.transform.position)
    .toEqual({ x: 0, y: 0, z: 0 });
});

test("a voxel map re-picks its map from its field, then moves above the light", async({ page, target }) => {
  test.slow();
  await treeRow(page, "Sky").click();
  await addComponent(page, "Voxel map…");

  const picker = dialog(page, "Pick a voxel map");
  await picker.getByRole("searchbox").fill(target.mapName);
  await treeRow(page, target.mapName).click();
  await picker.getByRole("button", { name: "Pick" }).click();
  await expect(picker).toBeHidden();

  const component = inspector(page).locator("jolly-folder[label=\"VoxelMap\"]");
  const map = component.locator("jolly-reference[label=\"Map\"]");
  await expect(map.getByRole("textbox")).toHaveText(target.mapName);
  expect((await findActor(page, "Sky"))?.components.map(({ type }) => type))
    .toEqual(["Light", "VoxelMap"]);

  await map.getByRole("button", { name: "Clear" }).click();
  await expect(map.getByRole("textbox")).toHaveText("<empty>");
  await map.getByRole("button", { name: "Browse" }).click();
  await picker.getByRole("searchbox").fill(target.mapName);
  await treeRow(page, target.mapName).click();
  await picker.getByRole("button", { name: "Pick" }).click();
  await expect(map.getByRole("textbox")).toHaveText(target.mapName);

  const grip = component.locator(".grip");
  await grip.focus();
  await grip.press("Space");
  await grip.press("ArrowUp");
  await grip.press("Space");
  await expect.poll(async() => (await findActor(page, "Sky"))?.components.map(({ type }) => type))
    .toEqual(["VoxelMap", "Light"]);
  await expect(inspector(page).locator("jolly-folder[reorderable]").first())
    .toHaveAttribute("label", "VoxelMap");
  await expect(grip).toHaveAttribute("aria-pressed", "false");
});
