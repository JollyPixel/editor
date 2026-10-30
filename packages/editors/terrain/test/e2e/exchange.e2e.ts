// Import Node.js Dependencies
import { readFile } from "node:fs/promises";

// Import Third-party Dependencies
import type { Download, Locator } from "@playwright/test";
import {
  decodePng,
  parseHeightmapSidecar
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

// CONSTANTS
const kSample = { x: 20, z: 20 };

async function filePayload(
  download: Download
) {
  return {
    name: download.suggestedFilename(),
    mimeType: "application/octet-stream",
    buffer: await readFile(await download.path())
  };
}

async function setNumber(
  panel: Locator,
  field: string,
  value: number
): Promise<void> {
  const input = panel.locator(`jolly-number[data-field=${field}] input`);
  await input.fill(String(value));
  await input.press("Enter");
}

test.slow();

test("a heightmap exported from the pane imports back at a doubled range and undoes as one step", async({
  terrain
}) => {
  const { page } = terrain;
  const panel = page.locator("terrain-exchange-panel");
  await terrain.viewport.pinCamera({ position: { x: kSample.x, y: 120, z: kSample.z }, pitch: -Math.PI / 2 });
  await expect.poll(() => terrain.chunkLoaded(0, 0)).toBe(true);
  const height = await terrain.confirmedHeightAt(kSample.x, kSample.z);

  const downloads: Download[] = [];
  page.on("download", (download) => downloads.push(download));
  await panel.locator("[data-action=export-heightmap]").click();
  await expect.poll(() => downloads.length).toBe(2);

  const [image, sidecar] = await Promise.all(downloads.map(filePayload));
  expect(image.name.endsWith(".png")).toBe(true);
  expect((await decodePng(new Uint8Array(image.buffer))).depth).toBe(16);
  const { min, max } = parseHeightmapSidecar(sidecar.buffer.toString())!;

  await panel.locator("input[data-input=heightmap]").setInputFiles([image, sidecar]);
  await expect(panel.locator("[data-action=import-heightmap]")).toBeVisible();
  const taller = Math.ceil(max + (max - min));
  await setNumber(panel, "max", taller);
  await panel.locator("[data-action=import-heightmap]").click();

  const raised = min + (height - min) / (max - min) * (taller - min);
  await expect.poll(() => terrain.confirmedHeightAt(kSample.x, kSample.z))
    .toBeCloseTo(raised, 1);

  await terrain.undo();
  await expect.poll(() => terrain.confirmedHeightAt(kSample.x, kSample.z))
    .toBeCloseTo(height, 3);
});
