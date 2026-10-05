// Import Third-party Dependencies
import type { Locator } from "@playwright/test";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect, editorPanel } from "./fixtures.ts";
import {
  clickTexturePixel,
  clickToolOption,
  readBrush,
  seedTexture,
  setMode
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

function paletteColor(
  panel: Locator,
  index: number
) {
  return panel.evaluate((element: PixelDrawPanel, slot) => (
    element.canvasManager!.document.palette.colorAt(slot)
  ), index);
}

async function dock(
  panel: Locator
): Promise<void> {
  await panel.getByRole("button", { name: "Docked color picker" }).click();
  await expect(panel.locator("color-palette-grid")).toBeVisible();
}

test("palette selection, alpha editing and peer updates survive reload", async({
  panel,
  peer,
  page
}) => {
  await dock(panel);
  const peerPanel = editorPanel(peer);
  await dock(peerPanel);
  const grid = panel.locator("color-palette-grid");
  await expect(grid.locator(".grid button")).toHaveCount(10);
  const slot = grid.getByRole("button", { name: "Palette color 4", exact: true });
  await slot.click();
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator("color-picker-popover").getByRole("dialog")).toBeHidden();
  await expect.poll(() => readBrush(panel)).toEqual({
    primary: "#e63946",
    secondary: "#e63946"
  });
  const slots = await grid.locator(".grid button").all();
  const first = (await slots[0].boundingBox())!;
  const second = (await slots[1].boundingBox())!;
  const third = (await slots[2].boundingBox())!;
  const last = (await slots[9].boundingBox())!;
  expect(second.y).toBe(first.y);
  expect(second.x).toBeGreaterThan(first.x);
  expect(third.x).toBe(first.x);
  expect(third.y).toBeGreaterThan(first.y);
  const dockBox = (await panel.locator("color-dock").boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(dockBox.y + dockBox.height);
  const swatch = await slot.boundingBox();
  const picker = await panel.locator("color-dock > jolly-color-picker").boundingBox();
  expect(swatch!.x + swatch!.width).toBeLessThan(picker!.x);
  const clusterCenter = (first.x + picker!.x + picker!.width) / 2;
  expect(Math.abs(clusterCenter - (dockBox.x + dockBox.width / 2))).toBeLessThan(1);
  const focus = await slot.evaluate((element) => {
    return {
      outline: getComputedStyle(element).outlineWidth,
      inset: getComputedStyle(element, "::after").top
    };
  });
  expect(focus).toEqual({ outline: "0px", inset: "0px" });

  await slot.dblclick();
  const dialog = panel.locator("color-picker-popover").getByRole("dialog", { name: "Edit palette color" });
  await expect(dialog).toBeVisible();
  const background = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).toMatch(/^rgb[(]/);
  await expect(panel.locator("color-picker-popover jolly-color-picker")).toHaveCount(1);
  await dialog.locator("input.hex").fill("#12345680");
  await dialog.locator("input.hex").press("Enter");
  const color = { r: 18, g: 52, b: 86, a: 128 };
  await expect.poll(() => paletteColor(panel, 3)).toEqual(color);
  await expect.poll(() => paletteColor(peerPanel, 3)).toEqual(color);
  await expect(peerPanel.getByRole("button", {
    name: "Palette color 4", exact: true
  })).toHaveAttribute("aria-pressed", "false");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await waitForEditor(page);
  await expect.poll(() => paletteColor(panel, 3)).toEqual(color);
  await panel.getByRole("button", { name: "Palette color 4", exact: true }).click();
  await expect.poll(() => readBrush(panel)).toEqual({
    primary: "#123456",
    secondary: "#123456"
  });
});

test("Pick color replaces only the selected slot and undo restores it", async({ panel }) => {
  await seedTexture(panel, [{ x: 5, y: 30, color: "#3355ff" }]);
  await setMode(panel, "paint");
  await dock(panel);
  const before = await paletteColor(panel, 5);
  const adjacent = await paletteColor(panel, 4);
  await panel.getByRole("button", { name: "Palette color 6", exact: true }).click();
  await clickToolOption(panel, "paint", "Pick color");
  await clickTexturePixel(panel, { x: 5, y: 30 });
  await expect.poll(() => paletteColor(panel, 5)).toEqual({
    r: 51, g: 85, b: 255, a: 255
  });
  expect(await paletteColor(panel, 4)).toEqual(adjacent);
  await expect.poll(() => readBrush(panel)).toEqual({
    primary: "#3355ff", secondary: "#3355ff"
  });
  await panel.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => paletteColor(panel, 5)).toEqual(before);
});

test("F2 edits a palette slot and dismissing a picker cancels an uncommitted draft", async({
  panel,
  page
}) => {
  await dock(panel);
  const grid = panel.locator("color-palette-grid");
  const slot = grid.getByRole("button", { name: "Palette color 4", exact: true });
  await slot.focus();
  await slot.press("Enter");
  await slot.press("F2");
  const dialog = panel.locator("color-picker-popover").getByRole("dialog");
  await expect(dialog).toBeVisible();
  const before = await paletteColor(panel, 3);
  const area = dialog.getByRole("group", { name: "Saturation and value" });
  const box = await area.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect.poll(() => readBrush(panel)).not.toMatchObject({ primary: "#e63946" });
  expect(await paletteColor(panel, 3)).toEqual(before);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(dialog).toBeHidden();
  expect(await paletteColor(panel, 3)).toEqual(before);
  await expect.poll(() => readBrush(panel)).toEqual({
    primary: "#e63946", secondary: "#e63946"
  });
});

test("foreground, background and palette slots reuse one popover picker", async({ panel }) => {
  const shared = panel.locator("color-picker-popover");
  const picker = shared.locator("jolly-color-picker");
  const handle = await picker.elementHandle();
  await panel.locator("color-swatch.fg button").click();
  await expect(shared.getByRole("dialog")).toBeVisible();
  await picker.locator("input.hex").fill("#112233");
  await picker.locator("input.hex").press("Enter");
  await panel.locator("color-swatch.bg button").click();
  await expect(shared.getByRole("dialog")).toBeVisible();
  await picker.locator("input.hex").fill("#445566");
  await picker.locator("input.hex").press("Enter");
  await expect.poll(() => readBrush(panel)).toEqual({
    primary: "#112233", secondary: "#445566"
  });
  await shared.getByRole("button", { name: "Done" }).click();
  await dock(panel);
  await panel.getByRole("button", { name: "Palette color 10", exact: true }).dblclick();
  await expect(shared.getByRole("dialog", { name: "Edit palette color" })).toBeVisible();
  await expect(picker).toHaveCount(1);
  expect(await handle!.evaluate((element) => element.isConnected)).toBe(true);
  await picker.locator("input.hex").fill("#778899");
  await picker.locator("input.hex").press("Enter");
  await expect.poll(() => paletteColor(panel, 9)).toEqual({
    r: 119, g: 136, b: 153, a: 255
  });
});

test("a peer edit preserves a local picker draft until it is dismissed", async({ panel, peer, page }) => {
  await dock(panel);
  const peerPanel = editorPanel(peer);
  await dock(peerPanel);
  await panel.getByRole("button", { name: "Palette color 4", exact: true }).dblclick();
  const dialog = panel.locator("color-picker-popover").getByRole("dialog");
  const area = dialog.getByRole("group", { name: "Saturation and value" });
  const box = (await area.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => readBrush(panel)).not.toMatchObject({ primary: "#e63946" });
  const draft = await readBrush(panel);
  await peerPanel.getByRole("button", { name: "Palette color 4", exact: true }).click();
  const hex = peerPanel.locator("color-dock > jolly-color-picker input.hex");
  await hex.fill("#0c223880");
  await hex.press("Enter");
  await expect.poll(() => paletteColor(panel, 3)).toEqual({ r: 12, g: 34, b: 56, a: 128 });
  expect(await readBrush(panel)).toEqual(draft);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(dialog).toBeHidden();
  await expect.poll(() => readBrush(panel)).toEqual({
    primary: "#0c2238", secondary: "#0c2238"
  });
});

test("clicking outside the canvas deselects the slot and keeps the working color", async({ panel }) => {
  await setMode(panel, "paint");
  await dock(panel);
  const slot = panel.getByRole("button", { name: "Palette color 4", exact: true });
  await slot.click();
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await clickTexturePixel(panel, { x: 12, y: 28 });
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await setMode(panel, "paint");
  await expect(slot).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => readBrush(panel)).toEqual({
    primary: "#e63946", secondary: "#e63946"
  });
  const before = await paletteColor(panel, 3);
  const hex = panel.locator("color-dock > jolly-color-picker input.hex");
  await hex.fill("#112233");
  await hex.press("Enter");
  expect(await paletteColor(panel, 3)).toEqual(before);
});
