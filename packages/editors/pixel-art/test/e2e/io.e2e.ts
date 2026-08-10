// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

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

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("Export downloads the texture as a PNG", async({ page }) => {
  await setMode(page, "paint");
  // Paint one unique pixel so export is non-empty.
  await clickTexturePixel(page, 30, 25);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export texture" }).click()
  ]);

  expect(download.suggestedFilename()).toBe("texture.png");
  expect(await download.path()).toBeTruthy();
});

test("Import replaces the texture from a PNG file", async({ page }) => {
  // Import replaces the whole buffer; corner pixel keeps it isolated.
  const dataUrl = await page.evaluate((size) => {
    const canvas = document.createElement("canvas");
    canvas.width = size.x;
    canvas.height = size.y;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size.x, size.y);
    ctx.fillStyle = "#ff8800";
    ctx.fillRect(size.x - 1, size.y - 1, 1, 1);

    return canvas.toDataURL("image/png");
  }, TEXTURE_SIZE);

  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");

  await page.locator(".file-input").setInputFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer
  });

  await expect.poll(() => readPixel(page, TEXTURE_SIZE.x - 1, TEXTURE_SIZE.y - 1))
    .toEqual({ r: 0xff, g: 0x88, b: 0, a: 255 });
});

test("dragging one raster over the texture shows the bounded overlay and replaces it on drop", async({ page }) => {
  await setMode(page, "fill");
  const point = await textureToScreenPoint(page, 20, 20);
  await page.evaluate(({ x, y }) => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
    const stage = panel.shadowRoot!.querySelector<HTMLElement>(".stage")!;
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 3;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, 4, 3);
    context.fillStyle = "#22aa66";
    context.fillRect(3, 2, 1, 1);
    const dataUrl = canvas.toDataURL("image/png");
    const bytes = Uint8Array.from(
      atob(dataUrl.split(",")[1]),
      (character) => character.charCodeAt(0)
    );
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "drop.png", { type: "image/png" }));
    Object.assign(window, { __textureDropTransfer: transfer });
    stage.dispatchEvent(new DragEvent("dragover", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      dataTransfer: transfer
    }));
  }, point);

  await expect(page.locator("pixel-draw-panel").locator(".texture-drop-overlay"))
    .toContainText("Drop image to replace texture");

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

  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;

    return {
      mode: panel.canvasManager!.mode,
      size: panel.canvasManager!.textureSize
    };
  })).toEqual({
    mode: "fill",
    size: { x: 4, y: 3 }
  });
  await expect.poll(() => readPixel(page, 3, 2))
    .toEqual({ r: 0x22, g: 0xaa, b: 0x66, a: 255 });
  await expect(page.locator("pixel-draw-panel").locator(".texture-drop-overlay"))
    .toHaveCount(0);
});
