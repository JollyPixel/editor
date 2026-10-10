// Import Third-party Dependencies
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { TextureEditor } from "./support/texture.ts";

function textureState(
  texture: TextureEditor
) {
  return texture.panel.evaluate((element: PixelDrawPanel) => {
    return {
      activeTextureId: element.activeTextureId,
      textureIds: element.textures.map((entry) => entry.id),
      selectedRegionId: element.canvasManager?.uv.selectedRegionId ?? null
    };
  });
}

test.beforeEach(async({ map }) => {
  await map.panes.open("Paint");
});

test("the texture follows the selected block", async({ map, page }) => {
  await expect.poll(() => textureState(map.texture)).toEqual({
    activeTextureId: "default",
    textureIds: ["default"],
    selectedRegionId: "block-1"
  });

  await page.evaluate(() => {
    window.voxelMapEditor!.workspace.state.block.id = 5;
  });

  await expect.poll(async() => (await textureState(map.texture)).selectedRegionId)
    .toBe("block-5");
});

test("texture edits reach a peer", async({ map, peerMap }) => {
  test.slow();
  await peerMap.panes.open("Paint");
  const texel = await map.texture.blockTileCenter(2);
  await expect.poll(() => peerMap.texture.pixelAlpha(texel)).toBe(255);

  await map.texture.selectMode("Erase");
  await map.texture.clickTexel(texel);

  await expect.poll(() => peerMap.texture.pixelAlpha(texel)).toBe(0);
});
