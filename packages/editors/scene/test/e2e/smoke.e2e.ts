// Import Third-party Dependencies
import {
  dialog,
  textField,
  treeRow
} from "@jolly-pixel/e2e";
import { pressAt } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  addActor,
  addComponent,
  hierarchy,
  inspector,
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
  await expect(textField(inspector(page), "Name")).toHaveValue("Box");
  await expect(inspector(page).locator("jolly-folder[label=\"Mesh\"]")).toBeVisible();

  const x = transformAxis(page, "Position", "X");
  await x.fill("2");
  await x.press("Enter");

  await expect.poll(async() => (await findActor(page, "Box"))?.transform.position)
    .toEqual({ x: 2, y: 0, z: 0 });
});

test("a click in the viewport selects an actor and the gizmo moves it in one undo step", async({ page }) => {
  test.slow();
  await addActor(page, ["Primitive", "Box"]);
  await treeRow(page, "Main Camera").click();
  await expect(treeRow(page, "Box")).toHaveAttribute("aria-selected", "false");

  await pressAt(page, [await actorPoint(page, "Box", { x: 0, y: -0.3, z: 0.4 })]);
  await expect(treeRow(page, "Box")).toHaveAttribute("aria-selected", "true");

  await pressAt(page, await gizmoHandlePoints(page, "x"));
  await expect.poll(async() => (await findActor(page, "Box"))?.transform.position.x)
    .toBeGreaterThan(0.5);
  const moved = await findActor(page, "Box");
  expect(moved?.transform.position).toMatchObject({ y: 0, z: 0 });

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async() => (await findActor(page, "Box"))?.transform.position)
    .toEqual({ x: 0, y: 0, z: 0 });
});

test("a voxel map component takes the map picked from the catalog", async({ page, target }) => {
  await treeRow(page, "Sky").click();
  await addComponent(page, "Voxel map…");

  const picker = dialog(page, "Pick a voxel map");
  await picker.getByRole("searchbox").fill(target.mapName);
  await treeRow(page, target.mapName).click();
  await picker.getByRole("button", { name: "Pick" }).click();
  await expect(picker).toBeHidden();

  const component = inspector(page).locator("jolly-folder[label=\"VoxelMap\"]");
  await expect(component.getByText(target.mapName, { exact: true })).toBeVisible();
  expect((await findActor(page, "Sky"))?.components.map(({ type }) => type))
    .toEqual(["Light", "VoxelMap"]);
});
