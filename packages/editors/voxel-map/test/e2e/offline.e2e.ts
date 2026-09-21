// Import Third-party Dependencies
import {
  expect,
  test
} from "@playwright/test";

// Import Internal Dependencies
import { waitForEditor } from "./fixtures.ts";
import { openPane } from "./support/panels.ts";
import { seedVoxels } from "./support/scene.ts";
import {
  clickTexel,
  pixelAlpha,
  setTextureMode,
  texturePanel
} from "./support/texture.ts";

test("boots the seeded map from an in-page workspace, without a socket", async({ page }) => {
  const sockets: string[] = [];
  page.on("websocket", (socket) => {
    if (!socket.url().includes("token=")) {
      sockets.push(socket.url());
    }
  });

  await page.goto("/?offline&max-fps=10&samples=0");
  await waitForEditor(page);

  const state = await page.evaluate(() => {
    const { workspace, session } = window.voxelMapEditor!;
    const { engine } = workspace;

    return {
      target: session.target.record.id,
      username: session.identity.username,
      layers: engine.world.getLayers().map((layer) => layer.name),
      blocks: engine.blockRegistry.size,
      tilesets: engine.tilesets.definitions().map((tileset) => tileset.asset?.id)
    };
  });

  expect(state).toEqual({
    target: "offline-map",
    username: "Guest",
    layers: ["Ground"],
    blocks: 32,
    tilesets: ["offline-tileset"]
  });
  expect(sockets).toEqual([]);
});

test("snapshots offline map and texture edits", async({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?offline&max-fps=10&samples=0");
  await waitForEditor(page);
  const before = await page.evaluate(() => {
    const { catalog } = window.voxelMapEditor!.session;

    return {
      map: catalog.record("offline-map")!.revision,
      texture: catalog.record("offline-tileset")!.revision
    };
  });

  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 2 }]);
  await expect.poll(() => page.evaluate(
    () => window.voxelMapEditor!.session.catalog.record("offline-map")!.revision
  ), { timeout: 10_000 }).not.toBe(before.map);

  await openPane(page, "Paint");
  const panel = texturePanel(page);
  const texel = await page.evaluate(() => {
    const { engine } = window.voxelMapEditor!.workspace;
    const texture = engine.blockRegistry.get(1)!.defaultTexture!;
    const tileSize = engine.tilesets.definitions()[0].tileSize;

    return {
      x: texture.col * tileSize + Math.floor(tileSize / 2),
      y: texture.row * tileSize + Math.floor(tileSize / 2)
    };
  });
  await expect.poll(() => pixelAlpha(panel, texel)).toBe(255);
  await setTextureMode(panel, "Erase");
  await clickTexel(panel, texel);
  await expect.poll(() => pixelAlpha(panel, texel)).toBe(0);
  await expect.poll(() => page.evaluate(
    () => window.voxelMapEditor!.session.catalog
      .record("offline-tileset")!.revision
  )).not.toBe(before.texture);

  await page.evaluate(() => window.voxelMapEditor!.dispose());
  expect(errors).toEqual([]);
});
