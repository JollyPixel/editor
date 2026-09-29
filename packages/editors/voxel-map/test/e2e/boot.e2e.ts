// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

test("opens the requested world with its layer, blocks and tileset", async({ page, target }) => {
  const state = await page.evaluate(() => {
    const { view } = window.voxelMapEditor!.workspace;

    return {
      layers: view.document.world.getLayers().map((layer) => layer.name),
      blocks: view.document.blocks.size,
      tilesets: view.document.tilesets.definitions().map((tileset) => tileset.asset?.id)
    };
  });

  expect(state).toEqual({
    layers: ["Ground"],
    blocks: 32,
    tilesets: [target.tilesetId]
  });
});
