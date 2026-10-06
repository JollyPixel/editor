// Import Third-party Dependencies
import {
  expect,
  test
} from "@playwright/test";
import {
  dialog,
  recordSockets,
  titledDialog
} from "@jolly-pixel/e2e";
import {
  openEditor,
  waitForEditor
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { OFFLINE_EDITOR } from "./support/offline.ts";
import { openPane } from "./support/panels.ts";
import {
  blocksAt,
  seedVoxels
} from "./support/scene.ts";
import {
  clickTexel,
  pixelAlpha,
  setTextureMode,
  texturePanel
} from "./support/texture.ts";

test("boots the seeded map from an in-page workspace, without a socket", async({ page }) => {
  const sockets = recordSockets(page);
  await openEditor(page, OFFLINE_EDITOR);

  const state = await page.evaluate(() => {
    const { workspace, session } = window.voxelMapEditor!;
    const { view } = workspace;

    return {
      target: session.target.record.source,
      persistent: session.workspace?.persistent,
      username: session.identity.username,
      layers: view.document.world.getLayers().map((layer) => layer.name),
      blocks: view.document.blocks.size,
      tilesets: view.document.tilesets.definitions().map(
        (tileset) => session.catalog.record(tileset.asset?.id ?? "")?.source
      )
    };
  });

  expect(state).toEqual({
    target: "maps/overworld.voxelmap.json",
    persistent: true,
    username: "Guest",
    layers: ["Ground"],
    blocks: 0,
    tilesets: ["maps/overworld.tileset.json"]
  });
  expect(sockets).toEqual([]);
});

test("shares an offline catalog with a second tab", async({ page }) => {
  await openEditor(page, OFFLINE_EDITOR);
  const second = await page.context().newPage();
  try {
    await openEditor(second, OFFLINE_EDITOR);
    const id = await page.evaluate(
      () => window.voxelMapEditor!.session.catalog.create(
        "shared.bin",
        new TextEncoder().encode("shared"),
        { kind: "binary" }
      )
    );

    await expect.poll(() => second.evaluate(
      (assetId) => window.voxelMapEditor?.session.catalog.record(assetId)?.source,
      id
    )).toBe("shared.bin");
    expect(await second.evaluate(
      () => window.voxelMapEditor?.session.workspace?.persistent
    )).toBe(true);
  }
  finally {
    await second.close();
  }
});

test("offers an offline workspace when the socket is unreachable", async({ page }) => {
  await page.routeWebSocket("**/ws-sync", (socket) => {
    socket.close();
  });
  await page.goto("/?username=Guest");
  const offline = dialog(page, "Connection unavailable")
    .getByRole("button", { name: "Open offline workspace" });
  await expect(offline).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("html")).toHaveAttribute(
    "data-editor-state",
    "failed"
  );
  await offline.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-editor-state",
    "ready"
  );

  expect(await page.evaluate(
    () => window.voxelMapEditor?.session.workspace?.persistent
  )).toBe(true);
});

test("keeps offline map and texture edits across a reload", async({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openEditor(page, OFFLINE_EDITOR);
  await openPane(page, "Blocks");
  await page.getByRole("button", { name: "Add block" }).click();
  await titledDialog(page, "New Block")
    .getByRole("button", { name: "Create" })
    .click();

  const before = await page.evaluate(() => {
    const { session, workspace } = window.voxelMapEditor!;
    const mapId = session.target.record.id;
    const [tileset] = workspace.view.document.tilesets.definitions();
    const textureId = tileset.asset!.id;

    return {
      mapId,
      textureId,
      map: session.catalog.record(mapId)!.revision,
      texture: session.catalog.record(textureId)!.revision
    };
  });

  await seedVoxels(page, [{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await expect.poll(() => page.evaluate(
    (mapId) => window.voxelMapEditor!.session.catalog.record(mapId)!.revision,
    before.mapId
  ), { timeout: 10_000 }).not.toBe(before.map);

  await openPane(page, "Paint");
  const panel = texturePanel(page);
  const texel = { x: 16, y: 16 };
  await expect.poll(() => pixelAlpha(panel, texel)).toBe(0);
  await setTextureMode(panel, "Paint");
  await clickTexel(panel, texel);
  await expect.poll(() => pixelAlpha(panel, texel)).toBe(255);
  await expect.poll(() => page.evaluate(
    (textureId) => window.voxelMapEditor!.session.catalog
      .record(textureId)!.revision,
    before.textureId
  )).not.toBe(before.texture);

  await page.reload();
  await waitForEditor(page);
  expect(await page.evaluate(() => {
    const { session, workspace } = window.voxelMapEditor!;

    return {
      mapId: session.target.record.id,
      textureId: workspace.view.document.tilesets.definitions()[0].asset!.id
    };
  })).toEqual({
    mapId: before.mapId,
    textureId: before.textureId
  });
  expect(await blocksAt(page, [{ x: 0, y: 0, z: 0 }])).toEqual([1]);
  await openPane(page, "Paint");
  await expect.poll(() => pixelAlpha(texturePanel(page), texel)).toBe(255);

  await page.evaluate(() => window.voxelMapEditor!.dispose());
  expect(errors).toEqual([]);
});
