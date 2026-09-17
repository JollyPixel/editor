// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect,
  openEditor
} from "./fixtures.ts";
import { openPane } from "./support/panels.ts";
import {
  clickTexel,
  pixelAlpha,
  setTextureMode,
  texturePanel,
  textureState,
  type TexturePoint
} from "./support/texture.ts";

function tileCenter(
  page: Page,
  blockId: number
): Promise<TexturePoint> {
  return page.evaluate((id) => {
    const { engine } = window.voxelMapEditor!.scene;
    const texture = engine.blockRegistry.get(id)!.defaultTexture!;
    const tileSize = engine.tilesets.definitions()[0].tileSize;

    return {
      x: (texture.col * tileSize) + Math.floor(tileSize / 2),
      y: (texture.row * tileSize) + Math.floor(tileSize / 2)
    };
  }, blockId);
}

function alphaMode(
  page: Page,
  blockId: number
): Promise<string | undefined> {
  return page.evaluate(
    (id) => window.voxelMapEditor!.scene.engine.blockRegistry.get(id)?.alphaMode,
    blockId
  );
}

test.beforeEach(async({ page }) => {
  await openPane(page, "Paint");
});

test("the texture follows the selected block", async({ page }) => {
  const panel = texturePanel(page);

  await expect.poll(() => textureState(panel)).toEqual({
    activeTextureId: "default",
    textureIds: ["default"],
    selectedRegionId: "block-1"
  });

  await page.evaluate(() => {
    window.voxelMapEditor!.scene.editorState.brush.blockId = 5;
  });

  await expect.poll(async() => (await textureState(panel)).selectedRegionId)
    .toBe("block-5");
});

test("erasing a block tile makes the block transparent", async({ page }) => {
  const panel = texturePanel(page);
  const texel = await tileCenter(page, 1);
  expect(await alphaMode(page, 1)).not.toBe("blend");

  await setTextureMode(panel, "Erase");
  await clickTexel(panel, texel);

  await expect.poll(() => pixelAlpha(panel, texel)).toBe(0);
  await expect.poll(() => alphaMode(page, 1)).toBe("blend");
});

test("texture edits reach a peer", async({ page, browser, world }) => {
  const peerContext = await browser.newContext();
  const peer = await peerContext.newPage();

  try {
    await openEditor(peer, world, { username: "Peer" });
    await openPane(peer, "Paint");
    const texel = await tileCenter(page, 2);
    const peerPanel = texturePanel(peer);
    await expect.poll(() => pixelAlpha(peerPanel, texel)).toBe(255);

    const panel = texturePanel(page);
    await setTextureMode(panel, "Erase");
    await clickTexel(panel, texel);

    await expect.poll(() => pixelAlpha(peerPanel, texel)).toBe(0);
  }
  finally {
    await peerContext.close();
  }
});
