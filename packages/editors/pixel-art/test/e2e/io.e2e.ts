// Import Node.js Dependencies
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

// Import Third-party Dependencies
import { decodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  CLEAR,
  TEXTURE_SIZE
} from "./support/canvas.ts";
import { pngFile } from "./support/files.ts";
import type {
  PixelDrawPanel,
  TextureImportPolicy
} from "../../src/index.ts";

// CONSTANTS
const kCorner = {
  x: TEXTURE_SIZE.x - 1,
  y: TEXTURE_SIZE.y - 1
};

test("Export downloads the texture as a PNG with its pixels", async({ panel, page }) => {
  await panel.canvas.seed([{ x: 30, y: 25, color: "#ff8800" }]);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.exportButton.click()
  ]);

  expect(download.suggestedFilename()).toBe("texture.png");
  const image = await decodePng(await readFile(await download.path()));
  expect({ width: image.width, height: image.height })
    .toEqual({ width: TEXTURE_SIZE.x, height: TEXTURE_SIZE.y });
  const offset = ((25 * image.width) + 30) * 4;
  expect(Array.from(image.data.subarray(offset, offset + 4)))
    .toEqual([0xff, 0x88, 0, 0xff]);
});

test("Import replaces the texture without a dialog, tabs or busy scrim", async({ panel }) => {
  await panel.import(await pngFile("fixture.png", TEXTURE_SIZE, [
    { ...kCorner, color: "#ff8800" }
  ]));

  await expect.poll(() => panel.canvas.pixels([kCorner])).toEqual(["#ff8800ff"]);
  await expect(panel.dropStatus).toHaveText("Texture replaced");
  await expect(panel.importDialog.dialog).toBeHidden();
  await expect(panel.textures.strip).toHaveCount(0);
  await expect(panel.busy).toHaveCount(0);
});

test("an undecodable file is reported and leaves the texture untouched", async({ panel }) => {
  await panel.canvas.seed([{ x: 1, y: 1, color: "#ff8800" }]);

  await panel.import({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a png")
  });

  await expect(panel.dropStatus).toHaveText("Could not decode the image");
  expect(await panel.canvas.pixels([{ x: 1, y: 1 }])).toEqual(["#ff8800ff"]);
  expect(await panel.canvas.size()).toEqual(TEXTURE_SIZE);
});

test("the drop overlay names what the import policy will do", async({ panel }) => {
  const overlay = panel.root.locator(".texture-drop-overlay");
  const labels: Record<TextureImportPolicy, string> = {
    replace: "Drop image to replace texture",
    add: "Drop image to add texture",
    ask: "Drop image"
  };

  for (const [policy, label] of Object.entries(labels)) {
    await panel.root.evaluate((element: PixelDrawPanel, value) => {
      element.textureImportPolicy = value;
    }, policy as TextureImportPolicy);
    await panel.canvas.dragFileOver({ x: 20, y: 20 });
    await expect(overlay).toHaveText(label);
  }
});

test("dropping an image replaces the texture and keeps the current mode", async({ panel }) => {
  await panel.modes.select("fill");

  await panel.canvas.drop({ x: 20, y: 20 }, await pngFile("drop.png", { x: 4, y: 3 }, [
    { x: 3, y: 2, color: "#22aa66" }
  ]));

  await expect.poll(() => panel.canvas.size()).toEqual({ x: 4, y: 3 });
  expect(await panel.modes.active()).toBe("fill");
  expect(await panel.canvas.pixels([
    { x: 3, y: 2 },
    { x: 0, y: 0 }
  ])).toEqual(["#22aa66ff", CLEAR]);
  await expect(panel.root.locator(".texture-drop-overlay")).toHaveCount(0);
});
