// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import { TEXTURE_SIZE } from "./constants.ts";
import {
  clickTexturePixel,
  dropFile,
  importFile,
  pngFile,
  readPixels,
  setMode
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// CONSTANTS
const kImportSize = {
  x: 8,
  y: 6
};
const kImportCorner = {
  x: kImportSize.x - 1,
  y: kImportSize.y - 1
};
const kImportColor = "#22aa66";

function uniqueName(
  slug: string
): string {
  return `e2e-${slug}-${Date.now()}`;
}

function importPng(
  panel: Locator,
  name: string
): Promise<void> {
  return pngFile(`${name}.png`, kImportSize, [
    { ...kImportCorner, color: kImportColor }
  ]).then((file) => importFile(panel, file));
}

function panelState(
  panel: Locator
) {
  return panel.evaluate((element: PixelDrawPanel) => {
    const canvas = element.canvasManager!;

    return {
      activeTextureId: element.activeTextureId,
      textureIds: element.textures.map((texture) => texture.id),
      size: canvas.textureSize,
      mode: canvas.mode,
      camera: { ...canvas.viewport.camera },
      canUndo: canvas.canUndo()
    };
  });
}

async function waitForTextureSync(
  panel: Locator
): Promise<string> {
  const id = (await panelState(panel)).activeTextureId!;
  await panel.page().waitForFunction(
    (textureId) => window.__pixelSyncReadyTextures?.includes(textureId) === true,
    id
  );

  return id;
}

async function addThroughDialog(
  panel: Locator,
  name: string
): Promise<string> {
  const tabs = panel.getByRole("tab");
  const count = Math.max(await tabs.count(), 1);
  await importPng(panel, name);
  await panel.page().getByRole("button", { name: "Add as new" }).click();

  await expect(tabs).toHaveCount(count + 1);
  await expect(tabs.last()).toHaveText(name);
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");

  return waitForTextureSync(panel);
}

test.describe("import policy ask", () => {
  test.use({ demo: { importPolicy: "ask" } });

  test("Replace current replaces the active texture without a tab", async({ panel, page }) => {
    await importPng(panel, uniqueName("ask-replace"));
    await page.getByRole("button", { name: "Replace current" }).click();

    await expect.poll(() => readPixels(panel, [kImportCorner]))
      .toEqual([`${kImportColor}ff`]);
    await expect(panel.locator("jolly-tabs")).toHaveCount(0);
  });

  test("Cancel leaves the texture unchanged", async({ panel, page }) => {
    await importPng(panel, uniqueName("ask-cancel"));
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.locator("jolly-dialog")).toHaveCount(0);
    expect((await panelState(panel)).size).toEqual(TEXTURE_SIZE);
  });

  test("Add as new opens a tab with its own pixels, history and camera", async({ panel }) => {
    const undo = panel.getByRole("button", { name: "Undo" });
    await setMode(panel, "paint");
    await clickTexturePixel(panel, { x: 5, y: 5 });
    await expect(undo).toBeEnabled();
    await setMode(panel, "fill");
    const first = await panelState(panel);

    const addedId = await addThroughDialog(panel, uniqueName("ask-add"));

    expect(await panelState(panel)).toMatchObject({
      activeTextureId: addedId,
      size: kImportSize,
      mode: "fill",
      canUndo: false
    });
    await expect(undo).toBeDisabled();
    await expect.poll(() => readPixels(panel, [kImportCorner]))
      .toEqual([`${kImportColor}ff`]);

    const tabs = panel.getByRole("tab");
    await tabs.first().click();
    const restored = await panelState(panel);
    expect(restored).toMatchObject({
      activeTextureId: first.activeTextureId,
      size: TEXTURE_SIZE,
      mode: "fill",
      canUndo: true
    });
    expect(await readPixels(panel, [{ x: 5, y: 5 }])).toEqual(["#000000ff"]);
    await expect(undo).toBeEnabled();

    await tabs.last().click();
    expect((await panelState(panel)).camera).not.toEqual(restored.camera);
    await tabs.first().click();
    expect((await panelState(panel)).camera).toEqual(restored.camera);
  });

  test("a dropped image can be added as a new texture", async({ panel, page }) => {
    const name = uniqueName("ask-drop");

    await dropFile(panel, { x: 20, y: 20 }, await pngFile(`${name}.png`, { x: 4, y: 3 }));
    await page.getByRole("button", { name: "Add as new" }).click();

    await expect(panel.getByRole("tab")).toHaveText([/.+/, name]);
    await expect.poll(async() => (await panelState(panel)).size)
      .toEqual({ x: 4, y: 3 });
  });

  test("closing the active tab selects its neighbour, the last close hides the strip", async({ panel }) => {
    const first = (await panelState(panel)).activeTextureId;
    const second = uniqueName("ask-close-b");
    const third = uniqueName("ask-close-c");
    const secondId = await addThroughDialog(panel, second);
    await addThroughDialog(panel, third);
    const tabs = panel.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");

    await panel.getByRole("button", { name: `Close ${third}` }).click();
    await expect(tabs).toHaveCount(2);
    expect(await panelState(panel)).toMatchObject({
      activeTextureId: secondId,
      textureIds: [first, secondId]
    });

    await panel.getByRole("button", { name: `Close ${second}` }).click();
    await expect(panel.locator("jolly-tabs")).toHaveCount(0);
    expect(await panelState(panel)).toMatchObject({
      activeTextureId: first,
      textureIds: [first],
      size: TEXTURE_SIZE
    });
  });

  test("the canvas stays fitted to its host as the tab strip appears and hides", async({ panel }) => {
    function fitMismatches() {
      return panel.evaluate((element: PixelDrawPanel) => {
        const canvas = element.canvasManager!;
        const host = canvas.canvas();
        const box = host.getBoundingClientRect();
        const expected = `${Math.round(box.width)}x${Math.round(box.height)}`;

        return [
          `${host.width}x${host.height}`,
          `${canvas.viewport.canvasWidth}x${canvas.viewport.canvasHeight}`
        ].filter((size) => size !== expected);
      });
    }
    const name = uniqueName("ask-fit");
    await addThroughDialog(panel, name);
    await expect.poll(fitMismatches).toEqual([]);

    await panel.getByRole("button", { name: `Close ${name}` }).click();
    await expect(panel.locator("jolly-tabs")).toHaveCount(0);

    await expect.poll(fitMismatches).toEqual([]);
  });

  test("shortcuts only reach the active texture", async({ panel, page }) => {
    await addThroughDialog(panel, uniqueName("ask-hidden"));
    await setMode(panel, "paint");
    await clickTexturePixel(panel, { x: 1, y: 1 });
    await expect(panel.getByRole("button", { name: "Undo" })).toBeEnabled();

    await panel.evaluate((element: PixelDrawPanel) => {
      element.activeTextureId = element.textures[0].id;
    });
    await page.keyboard.press("Control+z");

    expect(await panel.evaluate(
      (element: PixelDrawPanel) => element.textures[1].canvas.canUndo()
    )).toBe(true);
  });
});

test.describe("import policy add", () => {
  test.use({ demo: { importPolicy: "add" } });

  test("Import adds a tab without asking", async({ panel, page }) => {
    const name = uniqueName("add");

    await importPng(panel, name);

    await expect(panel.getByRole("tab")).toHaveText([/.+/, name]);
    await expect(page.locator("jolly-dialog")).toHaveCount(0);
    expect((await panelState(panel)).size).toEqual(kImportSize);
  });
});

test.describe("import progress", () => {
  test.use({ demo: { importPolicy: "ask", addDelay: 1_500 } });

  test("a busy scrim covers the stage until the host has added the texture", async({ panel, page }) => {
    const busy = panel.locator(".stage-busy");
    const importButton = panel.getByRole("button", { name: "Import texture" });
    const name = uniqueName("busy-add");

    await importPng(panel, name);
    await page.getByRole("button", { name: "Add as new" }).click();

    await expect(busy).toContainText(`Adding ${name}`);
    await expect(busy.locator("jolly-spinner")).toHaveCount(1);
    await expect(importButton).toBeDisabled();

    await expect(busy).toHaveCount(0, { timeout: 10_000 });
    await expect(importButton).toBeEnabled();
    await expect(panel.getByRole("tab")).toHaveCount(2);
  });
});
