// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR,
  type TexturePoint
} from "./support/canvas.ts";
import type { PixelArtPanel } from "./support/panel.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// CONSTANTS
const kRed = "#ff0000ff";

function hasSelection(
  panel: PixelArtPanel
): Promise<boolean> {
  return panel.root.evaluate(
    (element: PixelDrawPanel) => element.canvasManager!.tools.select.hasSelection
  );
}

async function selectRect(
  panel: PixelArtPanel,
  from: TexturePoint,
  to: TexturePoint
): Promise<void> {
  await panel.modes.select("select");
  await panel.canvas.drag([from, to], { steps: 1 });
  await expect.poll(() => hasSelection(panel)).toBe(true);
}

test("dragging inside a rectangle selection moves its pixels", async({ panel }) => {
  await panel.canvas.seed([{ x: 42, y: 2, color: "#000000" }]);
  await selectRect(panel, { x: 41, y: 1 }, { x: 44, y: 4 });

  await panel.canvas.drag([
    { x: 42, y: 2 },
    { x: 42, y: 8 }
  ]);

  await expect.poll(() => panel.canvas.pixels([
    { x: 42, y: 8 },
    { x: 42, y: 2 }
  ])).toEqual([BLACK, CLEAR]);
});

test("H flips a selection horizontally", async({ panel, page }) => {
  await panel.canvas.seed([{ x: 46, y: 2, color: "#000000" }]);
  await selectRect(panel, { x: 46, y: 1 }, { x: 49, y: 4 });

  await page.keyboard.press("h");

  await expect.poll(() => panel.canvas.pixels([
    { x: 49, y: 2 },
    { x: 46, y: 2 }
  ])).toEqual([BLACK, CLEAR]);
});

test("V flips a selection vertically", async({ panel, page }) => {
  await panel.canvas.seed([
    { x: 51, y: 16, color: "#000000" },
    { x: 51, y: 17, color: "#ff0000" }
  ]);
  await selectRect(panel, { x: 51, y: 16 }, { x: 51, y: 17 });

  await page.keyboard.press("v");

  await expect.poll(() => panel.canvas.pixels([
    { x: 51, y: 16 },
    { x: 51, y: 17 }
  ])).toEqual([kRed, BLACK]);
});

test("R rotates a non-square selection clockwise around its center", async({ panel, page }) => {
  await panel.canvas.seed([
    { x: 46, y: 16, color: "#000000" },
    { x: 47, y: 16, color: "#ff0000" }
  ]);
  await selectRect(panel, { x: 46, y: 16 }, { x: 47, y: 16 });

  await page.keyboard.press("r");

  await expect.poll(() => panel.canvas.pixels([
    { x: 46, y: 16 },
    { x: 47, y: 16 },
    { x: 47, y: 17 }
  ])).toEqual([CLEAR, BLACK, kRed]);
});

test("the toolbar enables selection actions only once something is selected", async({ panel }) => {
  await panel.canvas.seed([{ x: 53, y: 10, color: "#000000" }]);
  await panel.modes.select("select");
  const copy = panel.root.getByRole("button", { name: "Copy selection" });
  const remove = panel.root.getByRole("button", { name: "Delete selection" });
  await expect(panel.root.getByRole("button", { name: "Paste image" })).toBeEnabled();
  await expect(copy).toBeDisabled();
  await expect(remove).toBeDisabled();

  await selectRect(panel, { x: 53, y: 10 }, { x: 54, y: 11 });
  await expect(copy).toBeEnabled();
  await remove.click();

  await expect.poll(() => panel.canvas.pixels([{ x: 53, y: 10 }]))
    .toEqual([CLEAR]);
});

test("Shape selects a contiguous blob and Delete only erases its mask", async({ panel, page }) => {
  await panel.canvas.seed([
    { x: 55, y: 1, width: 3, color: "#000000" },
    { x: 55, y: 2, height: 2, color: "#000000" },
    { x: 57, y: 3, color: "#00ffaa" }
  ]);
  await panel.modes.select("select");
  await panel.modes.pick("select", "Shape");

  await panel.canvas.click({ x: 56, y: 1 });
  await expect.poll(() => hasSelection(panel)).toBe(true);
  await page.keyboard.press("Delete");

  await expect.poll(() => panel.canvas.pixels([
    { x: 56, y: 1 },
    { x: 55, y: 3 },
    { x: 57, y: 3 }
  ])).toEqual([CLEAR, CLEAR, "#00ffaaff"]);
});

test.describe("clipboard", { lock: "clipboard" }, () => {
  test.use({
    permissions: ["clipboard-read", "clipboard-write"]
  });

  test("Ctrl+C then Ctrl+V pastes a copy that moves without its source", async({ panel, page }) => {
    await panel.canvas.seed([{ x: 42, y: 16, color: "#000000" }]);
    await selectRect(panel, { x: 41, y: 15 }, { x: 44, y: 18 });

    await page.keyboard.press("Control+c");
    await expect(panel.root.locator(".clipboard-status")).toContainText("Copied");
    await panel.canvas.hover({ x: 43, y: 17 });
    await page.keyboard.press("Control+v");
    await panel.canvas.drag([
      { x: 42, y: 16 },
      { x: 42, y: 21 }
    ]);

    await expect.poll(() => panel.canvas.pixels([
      { x: 42, y: 21 },
      { x: 42, y: 16 }
    ])).toEqual([BLACK, BLACK]);
  });

  test("an external image floats at the pointer in Select mode until deselected", async({ panel, page }) => {
    await panel.modes.select("paint");
    await panel.canvas.hover({ x: 48, y: 10 });
    await page.evaluate(async() => {
      const canvas = new OffscreenCanvas(3, 1);
      const context = canvas.getContext("2d")!;
      for (const [x, color] of ["#ff0080", "#0060ff", "#00d060"].entries()) {
        context.fillStyle = color;
        context.fillRect(x, 0, 1, 1);
      }
      const blob = await canvas.convertToBlob({ type: "image/png" });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
    });
    const row = [
      { x: 47, y: 10 },
      { x: 48, y: 10 },
      { x: 49, y: 10 }
    ];
    const pasted = ["#ff0080ff", "#0060ffff", "#00d060ff"];

    await page.keyboard.press("Control+v");

    await expect.poll(() => panel.modes.active()).toBe("select");
    await expect(panel.modes.button("select")).toHaveAttribute("aria-pressed", "true");
    await expect(panel.canvas.host.locator(
      "svg [data-overlay=selection][visibility=visible]"
    )).toHaveCount(2);
    await expect.poll(() => panel.canvas.renderedPixels(row)).toEqual(pasted);
    expect(await panel.canvas.pixels(row)).toEqual([CLEAR, CLEAR, CLEAR]);

    await panel.canvas.click({ x: 48, y: 10 });

    await expect.poll(() => panel.canvas.pixels(row)).toEqual(pasted);
  });
});
