// Import Third-party Dependencies
import {
  checkboxField,
  selectField,
  treeRow
} from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import {
  blockSummary,
  gizmoAttached
} from "../support/scene.ts";
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
} from "../support/animate.ts";

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
  await expect(transport.getByRole("button", { name: "Play" })).toBeVisible();

  const stopped = await playhead(page).textContent();
  await nextFrames(page, 3);
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
