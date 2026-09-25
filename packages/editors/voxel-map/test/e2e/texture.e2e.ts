// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import { openPane } from "./support/panels.ts";
import {
  blockTileCenter,
  clickTexel,
  pixelAlpha,
  setTextureMode,
  texturePanel,
  textureState
} from "./support/texture.ts";

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
    window.voxelMapEditor!.workspace.state.brush.blockId = 5;
  });

  await expect.poll(async() => (await textureState(panel)).selectedRegionId)
    .toBe("block-5");
});

test("texture edits reach a peer", async({ page, peer }) => {
  test.slow();
  await openPane(peer, "Paint");
  const texel = await blockTileCenter(page, 2);
  const peerPanel = texturePanel(peer);
  await expect.poll(() => pixelAlpha(peerPanel, texel)).toBe(255);

  const panel = texturePanel(page);
  await setTextureMode(panel, "Erase");
  await clickTexel(panel, texel);

  await expect.poll(() => pixelAlpha(peerPanel, texel)).toBe(0);
});
