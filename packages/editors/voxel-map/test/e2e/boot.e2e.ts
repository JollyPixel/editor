// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

test("opens the requested world with its layer, blocks and tileset", async({ page, world }) => {
  const state = await page.evaluate(() => {
    const { scene } = window.voxelMapEditor!;

    return {
      layers: scene.engine.world.getLayers().map((layer) => layer.name),
      blocks: scene.engine.blockRegistry.size,
      tilesets: scene.engine.tilesets.definitions().map((tileset) => tileset.src)
    };
  });

  expect(state).toEqual({
    layers: ["Ground"],
    blocks: 32,
    tilesets: [world.tilesetId]
  });
});
