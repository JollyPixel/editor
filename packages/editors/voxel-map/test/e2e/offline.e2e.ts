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
      target: session.target.record.source,
      persistent: session.workspace?.persistent,
      username: session.identity.username,
      layers: engine.world.getLayers().map((layer) => layer.name),
      blocks: engine.blockRegistry.size,
      tilesets: engine.tilesets.definitions().map(
        (tileset) => session.catalog.record(tileset.asset?.id ?? "")?.source
      )
    };
  });

  expect(state).toEqual({
    target: "maps/overworld.voxelmap.json",
    persistent: true,
    username: "Guest",
    layers: ["Ground"],
    blocks: 32,
    tilesets: ["textures/block.pixelart"]
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
    const { session, workspace } = window.voxelMapEditor!;
    const mapId = session.target.record.id;
    const [tileset] = workspace.engine.tilesets.definitions();
    const textureId = tileset.asset!.id;

    return {
      mapId,
      textureId,
      map: session.catalog.record(mapId)!.revision,
      texture: session.catalog.record(textureId)!.revision
    };
  });

  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 2 }]);
  await expect.poll(() => page.evaluate(
    (mapId) => window.voxelMapEditor!.session.catalog.record(mapId)!.revision,
    before.mapId
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
    (textureId) => window.voxelMapEditor!.session.catalog
      .record(textureId)!.revision,
    before.textureId
  )).not.toBe(before.texture);

  await page.evaluate(() => window.voxelMapEditor!.dispose());
  expect(errors).toEqual([]);
});
