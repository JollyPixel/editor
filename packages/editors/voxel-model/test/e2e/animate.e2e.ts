// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  checkboxField,
  dialog,
  selectField,
  textField,
  treeRow
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  blockSummary,
  gizmoAttached
} from "./support/scene.ts";
import {
  addNode,
  hierarchyAction
} from "./support/hierarchy.ts";
import {
  addClip,
  animatePanel,
  keys,
  openAnimateTab,
  playback,
  playhead,
  scrubTo,
  startClip,
  timeline,
  tool,
  typeAxis
} from "./support/animate.ts";

function numberField(
  scope: Locator,
  label: string
): Locator {
  return scope.locator("jolly-number").filter({ hasText: label }).getByRole("textbox");
}

async function createSet(
  page: Page,
  name: string
): Promise<void> {
  await tool(page, "New set").click();
  const form = dialog(page, "New Animation Set");
  await textField(form, "Set name").fill(name);
  await form.getByRole("button", { name: "OK" }).click();
  await expect(treeRow(page, name)).toBeVisible();
}

function actionMenu(
  page: Page
): Locator {
  return page.getByRole("menu", { name: "Animation actions" });
}

async function chooseMenuItem(
  page: Page,
  name: string
): Promise<void> {
  await actionMenu(page).getByRole("menuitem", { name, exact: true }).click();
}

async function rowMenu(
  page: Page,
  name: string,
  index = 0
): Promise<void> {
  await animatePanel(page).locator("jolly-tree").getByRole("treeitem")
    .filter({ has: page.getByText(name, { exact: true }) })
    .nth(index)
    .click({ button: "right" });
}

test("the timeline shows only in Animate and poses keyed blocks at the playhead", async({ page }) => {
  await expect(timeline(page)).toBeHidden();
  await openAnimateTab(page);
  await expect(timeline(page)).toBeVisible();
  await expect(timeline(page).getByText("Pick or create a clip")).toBeVisible();

  await startClip(page);
  await tool(page, "Key").click();
  await scrubTo(page, 0.99);
  await typeAxis(page, "X", 4);

  await expect(keys(page)).toHaveCount(2);
  await scrubTo(page, 0.5);
  await expect(playhead(page)).toContainText("Frame 12 / 24");
  await expect.poll(async() => (await blockSummary(page, "Block"))?.position.x).toBe(2);
  await expect(animatePanel(page).getByRole("textbox", { name: "X" })).toHaveValue("2.00");

  await page.getByRole("tab", { name: "Build" }).click();
  await expect(timeline(page)).toBeHidden();
  await expect.poll(async() => (await blockSummary(page, "Block"))?.position.x).toBe(0);
});

test("transform edits in Animate key the clip at the playhead and leave the rest pose", async({ page }) => {
  await startClip(page);
  await expect(page.getByRole("status").filter({ hasText: "Animating: Clip 1 · frame 0" })).toBeVisible();
  await expect.poll(() => gizmoAttached(page)).toBe(true);
  await expect(
    animatePanel(page).getByRole("radiogroup", { name: "Transform mode" }).getByRole("radio")
  ).toHaveText(["Pos", "Angle", "Scale"]);

  await scrubTo(page, 0.5);
  await typeAxis(page, "X", 3);

  await expect(keys(page)).toHaveCount(1);
  await expect(keys(page)).toHaveAttribute("data-tick", "12000");
  await expect.poll(async() => (await blockSummary(page, "Block"))?.position.x).toBe(3);

  await page.getByRole("tab", { name: "Build" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Animating" })).toHaveCount(0);
  await expect.poll(async() => (await blockSummary(page, "Block"))?.position.x).toBe(0);
});

test("keys are selected, dragged along the timeline and deleted", async({ page }) => {
  await startClip(page);
  await tool(page, "Key").click();
  await expect(keys(page)).toHaveAttribute("data-tick", "0");

  const key = await keys(page).boundingBox();
  const lane = await timeline(page).locator(".row[data-block] .lane").boundingBox();
  if (key === null || lane === null) {
    throw new Error("The key is not visible.");
  }
  await page.mouse.move(key.x + (key.width / 2), key.y + (key.height / 2));
  await page.mouse.down();
  await page.mouse.move(lane.x + (lane.width / 2), key.y + (key.height / 2), { steps: 4 });
  await page.mouse.up();

  await expect(keys(page)).toHaveAttribute("data-tick", "12000");
  await expect(keys(page)).toHaveAttribute("data-selected", "true");

  await page.keyboard.press("Delete");
  await expect(keys(page)).toHaveCount(0);
});

test("right-clicking a key selects it and its menu sets interpolation and deletes", async({ page }) => {
  await startClip(page);
  await tool(page, "Key").click();
  const menu = timeline(page).getByRole("menu", { name: "Timeline" });

  await keys(page).click({ button: "right" });
  await expect(keys(page)).toHaveAttribute("data-selected", "true");
  await menu.getByRole("menuitem", { name: "Interpolation" }).hover();
  await menu.getByRole("menuitem", { name: "Step", exact: true }).click();
  await expect(keys(page)).toHaveAttribute("data-interpolation", "step");

  await keys(page).click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(keys(page)).toHaveCount(0);

  await page.keyboard.press("Control+z");
  await expect(keys(page)).toHaveCount(1);
});

test("picking a key moves the playhead to it and the Key section sets its interpolation", async({ page }) => {
  await startClip(page);
  await scrubTo(page, 0.5);
  await typeAxis(page, "X", 3);
  await scrubTo(page, 0);
  const inspector = page.locator("jolly-model-editor-key-inspector");
  await expect(inspector.getByRole("region", { name: "Key" })).toHaveCount(0);

  await keys(page).click();
  await expect(playhead(page)).toContainText("Frame 12 / 24");
  await expect(inspector.getByText("Key (Block @ frame 12)")).toBeVisible();

  await selectField(inspector, "Interpolation").selectOption({ label: "Step" });
  await expect(keys(page)).toHaveAttribute("data-interpolation", "step");

  await page.keyboard.press("Control+z");
  await expect(keys(page)).toHaveAttribute("data-interpolation", "linear");
});

test("play in the Timeline header runs the playhead and pause stops it", async({ page }) => {
  await startClip(page);

  const transport = playback(page);
  await expect(transport).toContainText("24 fps");
  await transport.getByRole("button", { name: "Loop preview", pressed: true }).click();
  await expect(transport.getByRole("button", { name: "Loop preview", pressed: false })).toBeVisible();
  await expect(checkboxField(animatePanel(page), "Loop")).not.toBeChecked();
  await expect(transport.locator(".clip")).toHaveText("Clip 1");
  await expect(timeline(page).locator(".ruler .label")).toHaveText("");
  await transport.getByRole("button", { name: "Play" }).click();
  await expect(playhead(page)).not.toContainText("Frame 0 /");
  await transport.getByRole("button", { name: "Pause" }).click();

  const stopped = await playhead(page).textContent();
  await page.waitForTimeout(200);
  await expect(playhead(page)).toHaveText(stopped ?? "");
});

test("the focused timeline plays with Space and steps with the arrows, Home and End", async({ page }) => {
  await startClip(page);
  await timeline(page).getByRole("grid", { name: "Timeline" }).focus();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(playhead(page)).toContainText("Frame 2 / 24");
  await page.keyboard.press("ArrowLeft");
  await expect(playhead(page)).toContainText("Frame 1 / 24");
  await page.keyboard.press("End");
  await expect(playhead(page)).toContainText("Frame 24 / 24");
  await page.keyboard.press("Home");
  await expect(playhead(page)).toContainText("Frame 0 / 24");

  await page.keyboard.press("Space");
  await expect(playback(page).getByRole("button", { name: "Pause" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(playback(page).getByRole("button", { name: "Play" })).toBeVisible();
});

test("undo follows the open clip", async({ page }) => {
  await startClip(page);
  await tool(page, "Key").click();
  await addClip(page, "Clip 2");
  await treeRow(page, "Block").click();
  await tool(page, "Key").click();
  await expect(keys(page)).toHaveCount(1);

  await page.keyboard.press("Control+z");
  await expect(keys(page)).toHaveCount(0);
  await page.keyboard.press("Control+z");

  await treeRow(page, "Clip 1").click();
  await treeRow(page, "Block").click();
  await expect(keys(page)).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(keys(page)).toHaveCount(0);
});

test("the Animate tab opens on an empty state", async({ page }) => {
  await openAnimateTab(page);

  await expect(animatePanel(page).getByText("This model has no clip yet.")).toBeVisible();
  await expect(tool(page, "New clip")).toBeEnabled();
  await expect(tool(page, "New clip in a set")).toBeDisabled();

  await tool(page, "Animations options").click();
  await expect(actionMenu(page).getByRole("menuitem", { name: "Share as set…" })).toBeDisabled();
});

test("a first clip needs no set, and the model's clips can be shared as one", async({ page }) => {
  const name = `Humanoid ${crypto.randomUUID().slice(0, 8)}`;
  await startClip(page);
  const panel = animatePanel(page);
  await expect(panel.getByRole("region", { name: "Animations" }).getByRole("treeitem")).toHaveText(/Clip 1/);
  await expect(panel.getByText("Shared sets reuse clips")).toBeVisible();

  await tool(page, "Animations options").click();
  await chooseMenuItem(page, "Share as set…");
  const form = dialog(page, "Share as Set");
  await textField(form, "Set name").fill(name);
  await form.getByRole("button", { name: "OK" }).click();

  const shared = panel.getByRole("region", { name: "Shared sets" });
  await expect(shared.getByRole("treeitem", { name: new RegExp(name) })).toBeVisible();
  await expect(panel.getByText("This model has no clip yet.")).toBeVisible();
});

test("the model's clips refuse a taken name, copy to a set and fork back", async({ page }) => {
  const name = `Humanoid ${crypto.randomUUID().slice(0, 8)}`;
  await openAnimateTab(page);
  await addClip(page, "Walk");
  await tool(page, "New clip").click();
  const form = dialog(page, "New Clip");
  await textField(form, "Clip name").fill("walk");
  await expect(form.getByText("A clip named \"walk\" already exists in this model")).toBeVisible();
  await expect(form.getByRole("button", { name: "OK" })).toBeDisabled();
  await form.getByRole("button", { name: "Cancel" }).click();
  await createSet(page, name);

  await rowMenu(page, "Walk");
  await chooseMenuItem(page, "Copy to…");
  await chooseMenuItem(page, name);
  const panel = animatePanel(page);
  const shared = panel.getByRole("region", { name: "Shared sets" });
  const own = panel.getByRole("region", { name: "Animations" });
  await expect(shared.getByRole("treeitem", { name: /Walk/ })).toHaveAttribute("aria-selected", "true");
  await expect(own.getByRole("treeitem", { name: /Walk/ })).toHaveCount(1);

  await rowMenu(page, "Walk", 1);
  await chooseMenuItem(page, "Copy to…");
  await chooseMenuItem(page, "This model");
  const fork = dialog(page, "Copy \"Walk\" to this model");
  await expect(textField(fork, "Clip name")).toHaveValue("Walk 2");
  await fork.getByRole("button", { name: "OK" }).click();
  await expect(own.getByRole("treeitem", { name: /Walk 2/ })).toHaveAttribute("aria-selected", "true");
  await expect(shared.getByRole("treeitem", { name: /Walk/ })).toHaveCount(1);
});

test("renaming a keyed block in Build keeps its track", async({ page }) => {
  await startClip(page);
  await tool(page, "Key").click();
  await hierarchyAction(page, "Edit in Build").click();
  await treeRow(page, "Block").dblclick();
  const rename = page.getByRole("textbox", { name: "Rename" });
  await rename.fill("Torso");
  await rename.press("Enter");
  await expect(treeRow(page, "Torso")).toBeVisible();

  await openAnimateTab(page);
  await expect(animatePanel(page).getByRole("listitem")).toHaveCount(0);
  await expect(keys(page)).toHaveCount(1);
});

test("a deleted block's track shows unbound in Tracks and the timeline, rebound there", async({ page }) => {
  await addNode(page, "Block", "Torso");
  await startClip(page);
  await tool(page, "Key").click();
  await hierarchyAction(page, "Edit in Build").click();
  await treeRow(page, "Block").click();
  await hierarchyAction(page, "Delete").click();
  await dialog(page, "Delete Block").getByRole("button", { name: "Delete" }).click();
  await openAnimateTab(page);

  const tracks = animatePanel(page).getByRole("region", { name: "Tracks" });
  const track = tracks.getByRole("listitem", { name: "Block" });
  const unbound = timeline(page).locator(".row.unbound[data-track=\"Block\"]");
  await expect(track).toContainText("No block");
  await expect(unbound.locator(".key")).toHaveCount(1);
  await unbound.getByRole("button", { name: "Rebind Block" }).click();
  await page.getByRole("menu", { name: "Timeline" })
    .getByRole("menuitem", { name: "Torso", exact: true })
    .click();

  await expect(track).toContainText("→ Torso");
  await expect(unbound).toHaveCount(0);
  await treeRow(page, "Torso").click();
  await expect(keys(page)).toHaveCount(1);
});

test("a new set gets clips that are edited and deleted", async({ page }) => {
  const name = `Walk set ${crypto.randomUUID().slice(0, 8)}`;
  await openAnimateTab(page);
  await createSet(page, name);

  await tool(page, "New clip in a set").click();
  await chooseMenuItem(page, `In ${name}`);
  await dialog(page, `New Clip in ${name}`).getByRole("button", { name: "OK" }).click();
  const panel = animatePanel(page);
  await expect(treeRow(page, "Clip 1")).toHaveAttribute("aria-selected", "true");

  const clipName = textField(panel.getByRole("region", { name: "Clip", exact: true }), "Name");
  await clipName.fill("Walk");
  await clipName.press("Enter");
  await expect(treeRow(page, "Walk")).toBeVisible();

  await numberField(panel, "Length (frames)").fill("48");
  await numberField(panel, "Length (frames)").press("Enter");
  await expect(treeRow(page, "Walk")).toContainText("2.0s");

  await selectField(panel, "Frame rate").selectOption({ label: "12 fps" });
  await expect(numberField(panel, "Length (frames)")).toHaveValue("24");

  const loop = checkboxField(panel, "Loop");
  await expect(loop).not.toBeChecked();
  await loop.check();
  await page.keyboard.press("Control+z");
  await expect(loop).not.toBeChecked();

  await rowMenu(page, "Walk");
  await chooseMenuItem(page, "Delete");
  await dialog(page, "Delete Clip").getByRole("button", { name: "Delete" }).click();
  await expect(treeRow(page, "Walk")).toHaveCount(0);
  await expect(treeRow(page, name)).toHaveAttribute("aria-selected", "true");

  await rowMenu(page, name);
  await chooseMenuItem(page, "Unlink from this model");
  await expect(treeRow(page, name)).toHaveCount(0);

  await tool(page, "Link set").click();
  await chooseMenuItem(page, name);
  await expect(treeRow(page, name)).toHaveAttribute("aria-selected", "true");
});
