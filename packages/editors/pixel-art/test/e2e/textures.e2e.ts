// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import { TEXTURE_SIZE } from "./constants.ts";
import {
  gotoDemo,
  setMode,
  clickTexturePixel,
  readPixel,
  textureToScreenPoint
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// CONSTANTS
const kImportSize = {
  x: 8,
  y: 6
};
const kImportColor = {
  r: 0x22,
  g: 0xaa,
  b: 0x66,
  a: 255
};

function importName(
  slug: string
): string {
  return `e2e-w${test.info().parallelIndex}-${slug}`;
}

async function importPng(
  page: Page,
  fileName: string
): Promise<void> {
  const dataUrl = await page.evaluate(({ size, color }) => {
    const canvas = document.createElement("canvas");
    canvas.width = size.x;
    canvas.height = size.y;
    const context = canvas.getContext("2d")!;
    context.fillStyle = `rgb(${color.r} ${color.g} ${color.b})`;
    context.fillRect(size.x - 1, size.y - 1, 1, 1);

    return canvas.toDataURL("image/png");
  }, {
    size: kImportSize,
    color: kImportColor
  });

  await page.locator(".file-input").setInputFiles({
    name: fileName,
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.split(",")[1], "base64")
  });
}

async function canvasFitMismatches(
  page: Page
): Promise<string[]> {
  const { backing, box, viewport } = await activeCanvasFit(page);
  const mismatches: string[] = [];
  if (backing.x !== box.x || backing.y !== box.y) {
    mismatches.push(
      `backing ${backing.x}x${backing.y} != host box ${box.x}x${box.y}`
    );
  }
  if (viewport.x !== box.x || viewport.y !== box.y) {
    mismatches.push(
      `viewport ${viewport.x}x${viewport.y} != host box ${box.x}x${box.y}`
    );
  }

  return mismatches;
}

function activeCanvasFit(
  page: Page
) {
  return page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
    const canvas = panel.canvasManager!;
    const element = canvas.canvas();
    const box = element.getBoundingClientRect();

    return {
      backing: {
        x: element.width,
        y: element.height
      },
      box: {
        x: Math.round(box.width),
        y: Math.round(box.height)
      },
      viewport: {
        x: canvas.viewport.canvasWidth,
        y: canvas.viewport.canvasHeight
      }
    };
  });
}

function panelState(
  page: Page
) {
  return page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
    const canvas = panel.canvasManager!;

    return {
      activeTextureId: panel.activeTextureId,
      textureIds: panel.textures.map((texture) => texture.id),
      size: canvas.textureSize,
      mode: canvas.mode,
      brushSize: canvas.brush.size,
      camera: { ...canvas.viewport.camera },
      canUndo: canvas.canUndo()
    };
  });
}

async function addTextureThroughDialog(
  page: Page,
  name: string,
  expectedCount = 2
): Promise<string> {
  await importPng(page, `${name}.png`);
  await page.getByRole("button", { name: "Add as new" }).click();

  const tabs = page.locator("pixel-draw-panel [role=tab]");
  const added = expectedCount - 1;
  await expect(tabs).toHaveCount(expectedCount);
  await expect(tabs.nth(added)).toHaveText(name);
  await expect(tabs.nth(added)).toHaveAttribute("aria-selected", "true");

  const id = await page.evaluate(
    () => document.querySelector<PixelDrawPanel>("pixel-draw-panel")!.activeTextureId!
  );
  await page.waitForFunction(
    (textureId) => (window as unknown as {
      __pixelSyncReadyTextures?: string[];
    }).__pixelSyncReadyTextures?.includes(textureId) === true,
    id
  );

  return id;
}

test.describe("single texture", () => {
  test.beforeEach(async({ page }) => {
    await gotoDemo(page);
  });

  test("shows no tab strip and replaces on import without a dialog", async({ page }) => {
    await expect(page.locator("pixel-draw-panel jolly-tabs")).toHaveCount(0);

    await importPng(page, `${importName("replace")}.png`);

    await expect.poll(() => readPixel(page, kImportSize.x - 1, kImportSize.y - 1))
      .toEqual(kImportColor);
    await expect(page.locator("jolly-dialog")).toHaveCount(0);
    await expect(page.locator("pixel-draw-panel jolly-tabs")).toHaveCount(0);
  });
});

test.describe("texture import policy ask", () => {
  test.beforeEach(async({ page }) => {
    await gotoDemo(page, undefined, {
      importPolicy: "ask"
    });
  });

  test("Replace current replaces the active texture without a new tab", async({ page }) => {
    await importPng(page, `${importName("ask-replace")}.png`);
    await page.getByRole("button", { name: "Replace current" }).click();

    await expect.poll(() => readPixel(page, kImportSize.x - 1, kImportSize.y - 1))
      .toEqual(kImportColor);
    await expect(page.locator("pixel-draw-panel jolly-tabs")).toHaveCount(0);
  });

  test("Cancel leaves the texture unchanged", async({ page }) => {
    await importPng(page, `${importName("ask-cancel")}.png`);
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.locator("jolly-dialog")).toHaveCount(0);
    expect((await panelState(page)).size).toEqual(TEXTURE_SIZE);
  });

  test("Add as new opens a tab that keeps its own pixels, history and camera", async({ page }) => {
    await setMode(page, "paint");
    await clickTexturePixel(page, 5, 5);
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    const first = await panelState(page);

    await setMode(page, "fill");
    const name = importName("ask-add");
    const addedId = await addTextureThroughDialog(page, name);

    const added = await panelState(page);
    expect(added.activeTextureId).toBe(addedId);
    expect(added.size).toEqual(kImportSize);
    expect(added.mode).toBe("fill");
    expect(added.brushSize).toBe(first.brushSize);
    expect(added.canUndo).toBe(false);
    await expect.poll(() => readPixel(page, kImportSize.x - 1, kImportSize.y - 1))
      .toEqual(kImportColor);
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();

    const tabs = page.locator("pixel-draw-panel [role=tab]");
    await tabs.first().click();

    const restored = await panelState(page);
    expect(restored.activeTextureId).toBe(first.activeTextureId);
    expect(restored.size).toEqual(TEXTURE_SIZE);
    expect(restored.mode).toBe("fill");

    await tabs.nth(1).click();
    expect((await panelState(page)).camera).not.toEqual(restored.camera);
    await tabs.first().click();
    expect((await panelState(page)).camera).toEqual(restored.camera);
    expect(restored.canUndo).toBe(true);
    expect((await readPixel(page, 5, 5)).a).toBe(255);
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  });

  test("a third texture selects its own tab", async({ page }) => {
    const second = importName("ask-third-b");
    const third = importName("ask-third-c");
    await addTextureThroughDialog(page, second);
    const thirdId = await addTextureThroughDialog(page, third, 3);

    const tabs = page.locator("pixel-draw-panel [role=tab]");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "false");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    expect((await panelState(page)).activeTextureId).toBe(thirdId);
  });

  test("a drop shows the neutral overlay label and asks before adding", async({ page }) => {
    const name = importName("ask-drop");
    const point = await textureToScreenPoint(page, 20, 20);
    await page.evaluate(({ x, y, fileName }) => {
      const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
      const stage = panel.shadowRoot!.querySelector<HTMLElement>(".stage")!;
      const canvas = document.createElement("canvas");
      canvas.width = 4;
      canvas.height = 3;
      const bytes = Uint8Array.from(
        atob(canvas.toDataURL("image/png").split(",")[1]),
        (character) => character.charCodeAt(0)
      );
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], fileName, { type: "image/png" }));
      Object.assign(window, { __textureDropTransfer: transfer });
      stage.dispatchEvent(new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        dataTransfer: transfer
      }));
    }, {
      ...point,
      fileName: `${name}.png`
    });

    await expect(page.locator("pixel-draw-panel").locator(".texture-drop-overlay"))
      .toHaveText("Drop image");

    await page.evaluate(({ x, y }) => {
      const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
      const stage = panel.shadowRoot!.querySelector<HTMLElement>(".stage")!;
      const transfer = (window as unknown as {
        __textureDropTransfer: DataTransfer;
      }).__textureDropTransfer;
      stage.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        dataTransfer: transfer
      }));
    }, point);

    await page.getByRole("button", { name: "Add as new" }).click();
    const tabs = page.locator("pixel-draw-panel [role=tab]");
    await expect(tabs).toHaveText([/.+/, name]);
    await expect.poll(async() => (await panelState(page)).size).toEqual({ x: 4, y: 3 });
  });

  test("the tab strip appearing and hiding keeps the canvas fitted to its host", async({ page }) => {
    const name = importName("ask-fit");
    await addTextureThroughDialog(page, name);

    await expect.poll(() => canvasFitMismatches(page)).toEqual([]);

    await page.getByRole("button", { name: `Close ${name}` }).click();
    await expect(page.locator("pixel-draw-panel jolly-tabs")).toHaveCount(0);

    await expect.poll(() => canvasFitMismatches(page)).toEqual([]);
  });

  test("shortcuts stop reaching a texture hidden under the pointer", async({ page }) => {
    await addTextureThroughDialog(page, importName("ask-hover"));
    await setMode(page, "paint");
    await clickTexturePixel(page, 1, 1);
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();

    await page.evaluate(() => {
      const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
      panel.activeTextureId = panel.textures[0].id;
    });
    await page.keyboard.press("Control+z");

    const canUndoHidden = await page.evaluate(() => {
      const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;

      return panel.textures[1].canvas.canUndo();
    });
    expect(canUndoHidden).toBe(true);
  });

  test("closing the active tab selects its neighbour and hides the strip", async({ page }) => {
    const addedId = await addTextureThroughDialog(page, importName("ask-close"));

    await page.getByRole("button", { name: `Close ${importName("ask-close")}` }).click();

    await expect(page.locator("pixel-draw-panel jolly-tabs")).toHaveCount(0);
    const state = await panelState(page);
    expect(state.textureIds).not.toContain(addedId);
    expect(state.textureIds).toHaveLength(1);
    expect(state.activeTextureId).toBe(state.textureIds[0]);
    expect(state.size).toEqual(TEXTURE_SIZE);
  });
});

test.describe("import progress", () => {
  test("covers the stage until the host has added the texture", async({ page }) => {
    await gotoDemo(page, undefined, {
      importPolicy: "ask",
      addDelay: 1_500
    });

    const busy = page.locator("pixel-draw-panel .stage-busy");
    const importButton = page.getByRole("button", { name: "Import texture" });
    await expect(busy).toHaveCount(0);

    const name = importName("busy-add");
    await importPng(page, `${name}.png`);
    await page.getByRole("button", { name: "Add as new" }).click();

    await expect(busy).toBeVisible();
    await expect(busy).toContainText(`Adding ${name}`);
    await expect(busy.locator("jolly-spinner")).toHaveCount(1);
    await expect(importButton).toBeDisabled();

    await expect(busy).toHaveCount(0, { timeout: 10_000 });
    await expect(importButton).toBeEnabled();
    await expect(page.locator("pixel-draw-panel [role=tab]")).toHaveCount(2);
  });

  test("shows nothing for an import the host never holds", async({ page }) => {
    await gotoDemo(page);

    await importPng(page, `${importName("busy-replace")}.png`);

    await expect.poll(() => readPixel(page, kImportSize.x - 1, kImportSize.y - 1))
      .toEqual(kImportColor);
    await expect(page.locator("pixel-draw-panel .stage-busy")).toHaveCount(0);
  });
});
