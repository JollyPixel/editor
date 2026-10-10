// Import Third-party Dependencies
import {
  dialog,
  recordSockets
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  offlineTest as test,
  expect
} from "./fixtures.ts";
import { VoxelMapPage } from "./support/voxelMap.ts";

test("boots the seeded map from an in-page workspace, without a socket", async({ map, page }) => {
  const sockets = recordSockets(page);
  await map.openOffline();

  const state = await page.evaluate(() => {
    const { workspace, session } = window.voxelMapEditor!;
    const { view } = workspace;

    return {
      target: session.target.record.source,
      persistent: session.workspace?.persistent,
      username: session.identity.username,
      layers: view.document.world.getLayers().map((layer) => layer.name),
      blocks: view.document.blocks.size,
      blocksets: view.document.blocksets.definitions().map(
        (blockset) => session.catalog.record(blockset.asset?.id ?? "")?.source
      )
    };
  });

  expect(state).toEqual({
    target: "maps/overworld.voxelmap.json",
    persistent: true,
    username: "Guest",
    layers: ["Ground"],
    blocks: 0,
    blocksets: ["maps/overworld.blockset.json"]
  });
  expect(sockets).toEqual([]);
});

test("shares an offline catalog with a second tab", async({ map, page }) => {
  await map.openOffline();
  const second = new VoxelMapPage(await page.context().newPage());
  try {
    await second.openOffline();
    const id = await page.evaluate(
      () => window.voxelMapEditor!.session.catalog.create(
        "shared.bin",
        new TextEncoder().encode("shared"),
        { kind: "binary" }
      )
    );

    await expect.poll(() => second.page.evaluate(
      (assetId) => window.voxelMapEditor?.session.catalog.record(assetId)?.source,
      id
    )).toBe("shared.bin");
    expect(await second.page.evaluate(
      () => window.voxelMapEditor?.session.workspace?.persistent
    )).toBe(true);
  }
  finally {
    await second.page.close();
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

test("keeps offline map and texture edits across a reload", async({ map, page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await map.openOffline();
  await map.panes.open("Blocks");
  await map.blocks.library.addButton.click();
  await map.blockDialog("New Block").createButton.click();

  const before = await page.evaluate(() => {
    const { session, workspace } = window.voxelMapEditor!;
    const mapId = session.target.record.id;
    const [blockset] = workspace.view.document.blocksets.definitions();
    const textureId = blockset.asset!.id;

    return {
      mapId,
      textureId,
      map: session.catalog.record(mapId)!.revision,
      texture: session.catalog.record(textureId)!.revision
    };
  });

  await map.world.seed([{ x: 0, y: 0, z: 0, blockId: 1 }]);
  await expect.poll(() => page.evaluate(
    (mapId) => window.voxelMapEditor!.session.catalog.record(mapId)!.revision,
    before.mapId
  ), { timeout: 10_000 }).not.toBe(before.map);

  await map.panes.open("Paint");
  const texel = { x: 16, y: 16 };
  await expect.poll(() => map.texture.pixelAlpha(texel)).toBe(0);
  await map.texture.selectMode("Paint");
  await map.texture.clickTexel(texel);
  await expect.poll(() => map.texture.pixelAlpha(texel)).toBe(255);
  await expect.poll(() => page.evaluate(
    (textureId) => window.voxelMapEditor!.session.catalog
      .record(textureId)!.revision,
    before.textureId
  )).not.toBe(before.texture);

  await map.reload();
  expect(await page.evaluate(() => {
    const { session, workspace } = window.voxelMapEditor!;

    return {
      mapId: session.target.record.id,
      textureId: workspace.view.document.blocksets.definitions()[0].asset!.id
    };
  })).toEqual({
    mapId: before.mapId,
    textureId: before.textureId
  });
  expect(await map.world.blocks([{ x: 0, y: 0, z: 0 }])).toEqual([1]);
  await map.panes.open("Paint");
  await expect.poll(() => map.texture.pixelAlpha(texel)).toBe(255);

  await page.evaluate(() => window.voxelMapEditor!.dispose());
  expect(errors).toEqual([]);
});
