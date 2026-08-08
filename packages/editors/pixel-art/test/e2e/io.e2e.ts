// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import { TEXTURE_SIZE } from "./constants.ts";
import {
  gotoDemo,
  setMode,
  clickTexturePixel,
  readPixel
} from "./utils.ts";

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
