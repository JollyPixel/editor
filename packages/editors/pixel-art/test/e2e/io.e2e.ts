// Import Node.js Dependencies
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

// Import Third-party Dependencies
import type { Locator } from "@playwright/test";
import { decodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import { TEXTURE_SIZE } from "./constants.ts";
import {
  CLEAR,
  activeMode,
  dragFileOver,
  dropFile,
  importFile,
  pngFile,
  readPixels,
  seedTexture,
  setMode
} from "./utils.ts";
import type {
  PixelDrawPanel,
  TextureImportPolicy
} from "../../src/index.ts";

// CONSTANTS
const kCorner = {
  x: TEXTURE_SIZE.x - 1,
  y: TEXTURE_SIZE.y - 1
};

function textureSize(
  panel: Locator
) {
  return panel.evaluate(
    (element: PixelDrawPanel) => element.canvasManager!.textureSize
  );
}

test("Export downloads the texture as a PNG with its pixels", async({ panel, page }) => {
  await seedTexture(panel, [{ x: 30, y: 25, color: "#ff8800" }]);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.getByRole("button", { name: "Export texture" }).click()
  ]);

  expect(download.suggestedFilename()).toBe("texture.png");
  const image = await decodePng(await readFile(await download.path()));
  expect({ width: image.width, height: image.height })
    .toEqual({ width: TEXTURE_SIZE.x, height: TEXTURE_SIZE.y });
  const offset = ((25 * image.width) + 30) * 4;
  expect(Array.from(image.data.subarray(offset, offset + 4)))
    .toEqual([0xff, 0x88, 0, 0xff]);
});

test("Import replaces the texture without a dialog, tabs or busy scrim", async({ panel, page }) => {
  await importFile(panel, await pngFile("fixture.png", TEXTURE_SIZE, [
    { ...kCorner, color: "#ff8800" }
  ]));

  await expect.poll(() => readPixels(panel, [kCorner])).toEqual(["#ff8800ff"]);
  await expect(panel.locator("[part=drop-status]")).toHaveText("Texture replaced");
  await expect(page.locator("jolly-dialog")).toHaveCount(0);
  await expect(panel.locator("jolly-tabs")).toHaveCount(0);
  await expect(panel.locator(".stage-busy")).toHaveCount(0);
});

test("an undecodable file is reported and leaves the texture untouched", async({ panel }) => {
  await seedTexture(panel, [{ x: 1, y: 1, color: "#ff8800" }]);

  await importFile(panel, {
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a png")
  });

  await expect(panel.locator("[part=drop-status]"))
    .toHaveText("Could not decode the image");
  expect(await readPixels(panel, [{ x: 1, y: 1 }])).toEqual(["#ff8800ff"]);
  expect(await textureSize(panel)).toEqual(TEXTURE_SIZE);
});

test("the drop overlay names what the import policy will do", async({ panel }) => {
  const overlay = panel.locator(".texture-drop-overlay");
  const labels: Record<TextureImportPolicy, string> = {
    replace: "Drop image to replace texture",
    add: "Drop image to add texture",
    ask: "Drop image"
  };

  for (const [policy, label] of Object.entries(labels)) {
    await panel.evaluate((element: PixelDrawPanel, value) => {
      element.textureImportPolicy = value;
    }, policy as TextureImportPolicy);
    await dragFileOver(panel, { x: 20, y: 20 });
    await expect(overlay).toHaveText(label);
  }
});

test("dropping an image replaces the texture and keeps the current mode", async({ panel }) => {
  await setMode(panel, "fill");

  await dropFile(panel, { x: 20, y: 20 }, await pngFile("drop.png", { x: 4, y: 3 }, [
    { x: 3, y: 2, color: "#22aa66" }
  ]));

  await expect.poll(() => textureSize(panel)).toEqual({ x: 4, y: 3 });
  expect(await activeMode(panel)).toBe("fill");
  expect(await readPixels(panel, [
    { x: 3, y: 2 },
    { x: 0, y: 0 }
  ])).toEqual(["#22aa66ff", CLEAR]);
  await expect(panel.locator(".texture-drop-overlay")).toHaveCount(0);
});
