// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

test("opens the requested world with its layer, blocks and blockset", async({ page, target }) => {
  const state = await page.evaluate(() => {
    const { view } = window.voxelMapEditor!.workspace;

    return {
      layers: view.document.world.getLayers().map((layer) => layer.name),
      blocks: view.document.blocks.size,
      blocksets: view.document.blocksets.definitions().map((blockset) => blockset.asset?.id)
    };
  });

  expect(state).toEqual({
    layers: ["Ground"],
    blocks: 32,
    blocksets: [target.blocksetId]
  });
});
