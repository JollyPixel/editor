// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelArtPanel } from "./support/panel.ts";

async function dock(
  panel: PixelArtPanel
): Promise<void> {
  await panel.colors.dockToggle.click();
  await expect(panel.colors.grid).toBeVisible();
}

test("the docked palette lays ten slots out in two columns beside the picker", async({ panel }) => {
  const { colors } = panel;
  await dock(panel);
  await expect(colors.gridSlots).toHaveCount(10);
  const slot = colors.slot(4);
  await slot.click();
  const slots = await colors.gridSlots.all();
  const first = (await slots[0].boundingBox())!;
  const second = (await slots[1].boundingBox())!;
  const third = (await slots[2].boundingBox())!;
  const last = (await slots[9].boundingBox())!;
  expect(second.y).toBe(first.y);
  expect(second.x).toBeGreaterThan(first.x);
  expect(third.x).toBe(first.x);
  expect(third.y).toBeGreaterThan(first.y);
  const dockBox = (await colors.dock.boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(dockBox.y + dockBox.height);
  const swatch = await slot.boundingBox();
  const picker = await colors.dockedPicker.root.boundingBox();
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
});

test("a slot edit reaches the brush, a peer and the stored palette", async({
  panel,
  peerPanel
}) => {
  const { colors } = panel;
  await dock(panel);
  await dock(peerPanel);
  const slot = colors.slot(4);
  await slot.click();
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await expect(colors.popoverDialog).toBeHidden();
  await expect.poll(() => colors.brush()).toEqual({
    primary: "#e63946",
    secondary: "#e63946"
  });

  await slot.dblclick();
  const dialog = colors.popover.getByRole("dialog", { name: "Edit palette color" });
  await expect(dialog).toBeVisible();
  const background = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).toMatch(/^rgb[(]/);
  await expect(colors.popoverPicker.root).toHaveCount(1);
  await colors.popoverPicker.commit("#12345680");
  const color = { r: 18, g: 52, b: 86, a: 128 };
  await expect.poll(() => colors.paletteColor(3)).toEqual(color);
  await expect.poll(() => peerPanel.colors.paletteColor(3)).toEqual(color);
  await expect(peerPanel.colors.slot(4)).toHaveAttribute("aria-pressed", "false");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  await panel.reload();
  await expect.poll(() => colors.paletteColor(3)).toEqual(color);
  await colors.slot(4).click();
  await expect.poll(() => colors.brush()).toEqual({
    primary: "#123456",
    secondary: "#123456"
  });
});

test("Pick color replaces only the selected slot and undo restores it", async({ panel }) => {
  const { colors } = panel;
  await panel.canvas.seed([{ x: 5, y: 30, color: "#3355ff" }]);
  await panel.modes.select("paint");
  await dock(panel);
  const before = await colors.paletteColor(5);
  const adjacent = await colors.paletteColor(4);
  await colors.slot(6).click();
  await panel.modes.pick("paint", "Pick color");
  await panel.canvas.click({ x: 5, y: 30 });
  await expect.poll(() => colors.paletteColor(5)).toEqual({
    r: 51, g: 85, b: 255, a: 255
  });
  expect(await colors.paletteColor(4)).toEqual(adjacent);
  await expect.poll(() => colors.brush()).toEqual({
    primary: "#3355ff", secondary: "#3355ff"
  });
  await panel.undoButton.click();
  await expect.poll(() => colors.paletteColor(5)).toEqual(before);
});

test("F2 edits a palette slot and dismissing a picker cancels an uncommitted draft", async({
  panel,
  page
}) => {
  const { colors } = panel;
  await dock(panel);
  const slot = colors.slot(4);
  await slot.focus();
  await slot.press("Enter");
  await slot.press("F2");
  await expect(colors.popoverDialog).toBeVisible();
  const before = await colors.paletteColor(3);
  const box = await colors.popoverPicker.area.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect.poll(() => colors.brush()).not.toMatchObject({ primary: "#e63946" });
  expect(await colors.paletteColor(3)).toEqual(before);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(colors.popoverDialog).toBeHidden();
  expect(await colors.paletteColor(3)).toEqual(before);
  await expect.poll(() => colors.brush()).toEqual({
    primary: "#e63946", secondary: "#e63946"
  });
});

test("foreground, background and palette slots reuse one popover picker", async({ panel }) => {
  const { colors } = panel;
  const picker = colors.popoverPicker;
  const handle = await picker.root.elementHandle();
  await colors.foreground.click();
  await expect(colors.popoverDialog).toBeVisible();
  await picker.commit("#112233");
  await colors.background.click();
  await expect(colors.popoverDialog).toBeVisible();
  await picker.commit("#445566");
  await expect.poll(() => colors.brush()).toEqual({
    primary: "#112233", secondary: "#445566"
  });
  await colors.popover.getByRole("button", { name: "Done" }).click();
  await dock(panel);
  await colors.slot(10).dblclick();
  await expect(colors.popover.getByRole("dialog", { name: "Edit palette color" })).toBeVisible();
  await expect(picker.root).toHaveCount(1);
  expect(await handle!.evaluate((element) => element.isConnected)).toBe(true);
  await picker.commit("#778899");
  await expect.poll(() => colors.paletteColor(9)).toEqual({
    r: 119, g: 136, b: 153, a: 255
  });
});

test("a peer edit preserves a local picker draft until it is dismissed", async({
  panel,
  peerPanel,
  page
}) => {
  const { colors } = panel;
  await dock(panel);
  await dock(peerPanel);
  await colors.slot(4).dblclick();
  const box = (await colors.popoverPicker.area.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => colors.brush()).not.toMatchObject({ primary: "#e63946" });
  const draft = await colors.brush();
  await peerPanel.colors.slot(4).click();
  await peerPanel.colors.dockedPicker.commit("#0c223880");
  await expect.poll(() => colors.paletteColor(3)).toEqual({ r: 12, g: 34, b: 56, a: 128 });
  expect(await colors.brush()).toEqual(draft);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(colors.popoverDialog).toBeHidden();
  await expect.poll(() => colors.brush()).toEqual({
    primary: "#0c2238", secondary: "#0c2238"
  });
});

test("clicking outside the canvas deselects the slot and keeps the working color", async({ panel }) => {
  const { colors } = panel;
  await panel.modes.select("paint");
  await dock(panel);
  const slot = colors.slot(4);
  await slot.click();
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await expect(panel.undoButton).toBeDisabled();
  await panel.canvas.click({ x: 12, y: 28 });
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await panel.modes.select("paint");
  await expect(slot).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => colors.brush()).toEqual({
    primary: "#e63946", secondary: "#e63946"
  });
  const before = await colors.paletteColor(3);
  await colors.dockedPicker.commit("#112233");
  expect(await colors.paletteColor(3)).toEqual(before);
});
