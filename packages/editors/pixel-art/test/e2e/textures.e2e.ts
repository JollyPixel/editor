// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
import { TEXTURE_SIZE } from "./support/canvas.ts";
import {
  pngFile,
  uniqueName
} from "./support/files.ts";
import type { PixelArtPanel } from "./support/panel.ts";
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

async function importPng(
  panel: PixelArtPanel,
  name: string
): Promise<void> {
  await panel.import(await pngFile(`${name}.png`, kImportSize, [
    { ...kImportCorner, color: kImportColor }
  ]));
}

async function waitForTextureSync(
  panel: PixelArtPanel
): Promise<string> {
  const id = (await panel.textures.activeState()).activeTextureId!;
  await panel.page.waitForFunction(
    (textureId) => window.pixelArtEditor?.tabs.isSynced(textureId) === true,
    id
  );

  return id;
}

async function addThroughDialog(
  panel: PixelArtPanel,
  name: string
): Promise<string> {
  const { tabs } = panel.textures;
  const count = Math.max(await tabs.count(), 1);
  await importPng(panel, name);
  await panel.importDialog.addAsNew.click();
  await expect(panel.importDialog.dialog).toBeHidden();

  await expect(tabs).toHaveCount(count + 1);
  await expect(tabs.last()).toHaveText(name);
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");

  return waitForTextureSync(panel);
}

test.describe("import policy ask", () => {
  test.use({ editor: playground({ importPolicy: "ask" }) });

  test("Replace current replaces the active texture without a tab", async({ panel }) => {
    await importPng(panel, uniqueName("ask-replace"));
    await panel.importDialog.replaceCurrent.click();

    await expect.poll(() => panel.canvas.pixels([kImportCorner]))
      .toEqual([`${kImportColor}ff`]);
    await expect(panel.textures.strip).toHaveCount(0);
  });

  test("Cancel leaves the texture unchanged", async({ panel }) => {
    await importPng(panel, uniqueName("ask-cancel"));
    await panel.importDialog.cancel.click();

    await expect(panel.importDialog.dialog).toBeHidden();
    expect((await panel.textures.activeState()).size).toEqual(TEXTURE_SIZE);
  });

  test("Add as new opens a tab with its own pixels, history and camera", async({ panel }) => {
    const { undoButton } = panel;
    await panel.modes.select("paint");
    await panel.canvas.click({ x: 5, y: 5 });
    await expect(undoButton).toBeEnabled();
    await panel.modes.select("fill");
    const first = await panel.textures.activeState();

    const addedId = await addThroughDialog(panel, uniqueName("ask-add"));

    expect(await panel.textures.activeState()).toMatchObject({
      activeTextureId: addedId,
      size: kImportSize,
      mode: "fill",
      canUndo: false
    });
    await expect(undoButton).toBeDisabled();
    await expect.poll(() => panel.canvas.pixels([kImportCorner]))
      .toEqual([`${kImportColor}ff`]);

    const { tabs } = panel.textures;
    await tabs.first().click();
    const restored = await panel.textures.activeState();
    expect(restored).toMatchObject({
      activeTextureId: first.activeTextureId,
      size: TEXTURE_SIZE,
      mode: "fill",
      canUndo: true
    });
    expect(await panel.canvas.pixels([{ x: 5, y: 5 }])).toEqual(["#000000ff"]);
    await expect(undoButton).toBeEnabled();

    await tabs.last().click();
    expect((await panel.textures.activeState()).camera).not.toEqual(restored.camera);
    await tabs.first().click();
    expect((await panel.textures.activeState()).camera).toEqual(restored.camera);
  });

  test("a dropped image can be added as a new texture", async({ panel }) => {
    const name = uniqueName("ask-drop");

    await panel.canvas.drop({ x: 20, y: 20 }, await pngFile(`${name}.png`, { x: 4, y: 3 }));
    await panel.importDialog.addAsNew.click();

    await expect(panel.textures.tabs).toHaveText([/.+/, name]);
    await expect.poll(async() => (await panel.textures.activeState()).size)
      .toEqual({ x: 4, y: 3 });
  });

  test("closing the active tab selects its neighbour, the last close hides the strip", async({ panel }) => {
    const first = (await panel.textures.activeState()).activeTextureId;
    const second = uniqueName("ask-close-b");
    const third = uniqueName("ask-close-c");
    const secondId = await addThroughDialog(panel, second);
    await addThroughDialog(panel, third);
    const { tabs } = panel.textures;
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");

    await panel.textures.closeButton(third).click();
    await expect(tabs).toHaveCount(2);
    expect(await panel.textures.activeState()).toMatchObject({
      activeTextureId: secondId,
      textureIds: [first, secondId]
    });

    await panel.textures.closeButton(second).click();
    await expect(panel.textures.strip).toHaveCount(0);
    expect(await panel.textures.activeState()).toMatchObject({
      activeTextureId: first,
      textureIds: [first],
      size: TEXTURE_SIZE
    });
  });

  test("the canvas stays fitted to its host as the tab strip appears and hides", async({ panel }) => {
    function fitMismatches() {
      return panel.root.evaluate((element: PixelDrawPanel) => {
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

    await panel.textures.closeButton(name).click();
    await expect(panel.textures.strip).toHaveCount(0);

    await expect.poll(fitMismatches).toEqual([]);
  });

  test("shortcuts only reach the active texture", async({ panel, page }) => {
    await addThroughDialog(panel, uniqueName("ask-hidden"));
    await panel.modes.select("paint");
    await panel.canvas.click({ x: 1, y: 1 });
    await expect(panel.undoButton).toBeEnabled();

    await panel.root.evaluate((element: PixelDrawPanel) => {
      element.activeTextureId = element.textures[0].id;
    });
    await page.keyboard.press("Control+z");

    expect(await panel.root.evaluate(
      (element: PixelDrawPanel) => element.textures[1].canvas.canUndo()
    )).toBe(true);
  });
});

test.describe("import policy add", () => {
  test.use({ editor: playground({ importPolicy: "add" }) });

  test("Import adds a tab without asking", async({ panel }) => {
    const name = uniqueName("add");

    await importPng(panel, name);

    await expect(panel.textures.tabs).toHaveText([/.+/, name]);
    await expect(panel.importDialog.dialog).toBeHidden();
    expect((await panel.textures.activeState()).size).toEqual(kImportSize);
  });
});

test.describe("import progress", () => {
  test.use({ editor: playground({ importPolicy: "ask", addDelay: 1_500 }) });

  test("a busy scrim covers the stage until the host has added the texture", async({ panel }) => {
    const { busy, importButton } = panel;
    const name = uniqueName("busy-add");

    await importPng(panel, name);
    await panel.importDialog.addAsNew.click();

    await expect(busy).toContainText(`Adding ${name}`);
    await expect(busy.locator("jolly-spinner")).toHaveCount(1);
    await expect(importButton).toBeDisabled();

    await expect(busy).toHaveCount(0, { timeout: 10_000 });
    await expect(importButton).toBeEnabled();
    await expect(panel.textures.tabs).toHaveCount(2);
  });
});
