// Import Third-party Dependencies
import type { Locator } from "@playwright/test";
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
} from "../fixtures.ts";
import {
  addNode,
  deleteBlock,
  hierarchyAction,
  renameRow
} from "../support/hierarchy.ts";
import {
  addClip,
  animatePanel,
  chooseAnimationAction,
  createSet,
  keys,
  openAnimateTab,
  openClipMenu,
  startClip,
  timeline,
  tool
} from "../support/animate.ts";

function numberField(
  scope: Locator,
  label: string
): Locator {
  return scope.locator("jolly-number").filter({ hasText: label }).getByRole("textbox");
}

test("the Animate tab opens on an empty state", async({ page }) => {
  await openAnimateTab(page);

  await expect(animatePanel(page).getByText("This model has no clip yet.")).toBeVisible();
  await expect(tool(page, "New clip")).toBeEnabled();
  await expect(tool(page, "New clip in a set")).toBeDisabled();

  await tool(page, "Animations options").click();
  await expect(
    page.getByRole("menu", { name: "Animation actions" }).getByRole("menuitem", { name: "Share as set…" })
  ).toBeDisabled();
});

test("a first clip needs no set, and the model's clips can be shared as one", async({ page }) => {
  const name = `Humanoid ${crypto.randomUUID().slice(0, 8)}`;
  await startClip(page);
  const panel = animatePanel(page);
  await expect(panel.getByRole("region", { name: "Animations" }).getByRole("treeitem")).toHaveText(/Clip 1/);
  await expect(panel.getByText("Shared sets reuse clips")).toBeVisible();

  await tool(page, "Animations options").click();
  await chooseAnimationAction(page, "Share as set…");
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

  await openClipMenu(page, "Walk");
  await chooseAnimationAction(page, "Copy to…");
  await chooseAnimationAction(page, name);
  const panel = animatePanel(page);
  const shared = panel.getByRole("region", { name: "Shared sets" });
  const own = panel.getByRole("region", { name: "Animations" });
  await expect(shared.getByRole("treeitem", { name: /Walk/ })).toHaveAttribute("aria-selected", "true");
  await expect(own.getByRole("treeitem", { name: /Walk/ })).toHaveCount(1);

  await openClipMenu(page, "Walk", 1);
  await chooseAnimationAction(page, "Copy to…");
  await chooseAnimationAction(page, "This model");
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
  await renameRow(page, "Block", "Torso");
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
  await deleteBlock(page, "Block");
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
  await chooseAnimationAction(page, `In ${name}`);
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

  await openClipMenu(page, "Walk");
  await chooseAnimationAction(page, "Delete");
  await dialog(page, "Delete Clip").getByRole("button", { name: "Delete" }).click();
  await expect(treeRow(page, "Walk")).toHaveCount(0);
  await expect(treeRow(page, name)).toHaveAttribute("aria-selected", "true");

  await openClipMenu(page, name);
  await chooseAnimationAction(page, "Unlink from this model");
  await expect(treeRow(page, name)).toHaveCount(0);

  await tool(page, "Link set").click();
  await chooseAnimationAction(page, name);
  await expect(treeRow(page, name)).toHaveAttribute("aria-selected", "true");
});
