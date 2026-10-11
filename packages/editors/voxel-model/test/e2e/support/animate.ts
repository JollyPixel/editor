// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  dialog,
  textField,
  treeRow
} from "@jolly-pixel/e2e";

export function animatePanel(
  page: Page
): Locator {
  return page.locator("jolly-model-editor-animate-panel");
}

export function tool(
  page: Page,
  label: string
): Locator {
  return animatePanel(page).locator(`jolly-button[label="${label}"]`).getByRole("button");
}

export async function openAnimateTab(
  page: Page
): Promise<void> {
  await page.getByRole("tab", { name: "Animate" }).click();
  await expect(animatePanel(page)).toBeVisible();
}

export async function addClip(
  page: Page,
  name?: string
): Promise<void> {
  await tool(page, "New clip").click();
  const form = dialog(page, "New Clip");
  if (name !== undefined) {
    await textField(form, "Clip name").fill(name);
  }
  await form.getByRole("button", { name: "OK" }).click();
}

export function clipRow(
  page: Page,
  name: string
): Locator {
  return animatePanel(page).locator("jolly-tree").getByRole("treeitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

export async function openClipMenu(
  page: Page,
  name: string,
  index = 0
): Promise<void> {
  await clipRow(page, name).nth(index).click({ button: "right" });
}

export async function chooseAnimationAction(
  page: Page,
  name: string
): Promise<void> {
  await page.getByRole("menu", { name: "Animation actions" })
    .getByRole("menuitem", { name, exact: true })
    .click();
}

export async function createSet(
  page: Page,
  name: string
): Promise<void> {
  await tool(page, "New set").click();
  const form = dialog(page, "New Animation Set");
  await textField(form, "Set name").fill(name);
  await form.getByRole("button", { name: "OK" }).click();
  await expect(treeRow(page, name)).toBeVisible();
}

export function timeline(
  page: Page
): Locator {
  return page.locator("jolly-model-editor-timeline");
}

export function keys(
  page: Page
): Locator {
  return timeline(page).locator(".row[data-block] .key");
}

export function playback(
  page: Page
): Locator {
  return page.locator("jolly-model-editor-timeline-transport").getByRole("toolbar", { name: "Playback" });
}

export function playhead(
  page: Page
): Locator {
  return playback(page).getByLabel("Playhead");
}

export async function scrubTo(
  page: Page,
  fraction: number
): Promise<void> {
  const lane = timeline(page).getByLabel("Scrub");
  const box = await lane.boundingBox();
  if (box === null) {
    throw new Error("The timeline ruler is not visible.");
  }
  await page.mouse.click(box.x + (box.width * fraction), box.y + (box.height / 2));
}

export async function startClip(
  page: Page,
  name?: string
): Promise<void> {
  await openAnimateTab(page);
  await addClip(page, name);
  await expect(treeRow(page, name ?? "Clip 1")).toHaveAttribute("aria-selected", "true");
  await treeRow(page, "Block").click();
}

export async function typeAxis(
  page: Page,
  axis: "X" | "Y" | "Z",
  value: number
): Promise<void> {
  const field = animatePanel(page).getByRole("textbox", { name: axis });
  await field.fill(String(value));
  await field.press("Enter");
}
