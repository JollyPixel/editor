// Import Third-party Dependencies
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  MAP,
  TEXTURE
} from "./support/assets.ts";
import { joinedRooms } from "./support/shares.ts";
import { registerAccount } from "./support/account.ts";

test("editor frames read the catalog through the shell", async({ studio, page }) => {
  const rooms = joinedRooms(page);
  await registerAccount(page.request);
  await studio.open();

  await studio.assets.open(TEXTURE);
  await studio.frames.expectReady(studio.frames.only());

  expect(rooms.filter((room) => room === CATALOG_ROOM)).toHaveLength(1);
});

test("creates a map, a model, a texture and a scene from the tree and opens each", async({ studio }) => {
  test.slow();
  const { assets } = studio;
  await studio.openOffline();
  const created = [
    {
      kind: "Voxel map",
      file: "New voxel map.voxelmap.json",
      companion: "New voxel map.blockset.json",
      editor: "voxel-map"
    },
    {
      kind: "Voxel model",
      file: "New voxel model.voxelmodel.json",
      companion: "New voxel model.pixelart",
      editor: "voxel-model"
    },
    {
      kind: "Pixel art",
      file: "New pixel art.pixelart",
      companion: null,
      editor: "pixel-art"
    },
    {
      kind: "Scene",
      file: "New scene.scene.json",
      companion: null,
      editor: "scene"
    }
  ];

  for (const asset of created) {
    await assets.createAsset(asset.kind);
    await expect(assets.renameField).toHaveValue(asset.file);
    await assets.renameField.press("Escape");

    if (asset.companion !== null) {
      await expect(assets.row(asset.companion)).toBeVisible();
    }

    await assets.open(asset.file);
    await studio.frames.expectReady(studio.frames.locate(asset.editor));
    await studio.tabs.home.click();
  }
});

test("an editor frame opens the shell console, which themes every frame", async({ studio, commands }) => {
  test.slow();
  await studio.openOffline();
  await studio.assets.open(TEXTURE);
  const texture = studio.frames.only();
  await studio.frames.expectReady(texture);
  await expect(texture.locator("jolly-console")).toHaveCount(0);

  await texture.locator("pixel-draw-panel")
    .getByRole("button")
    .first()
    .focus();
  await commands.open();
  await commands.submit("theme light");
  await commands.close();

  await expect(studio.theme).toHaveAttribute("theme", "light");
  await expect(texture.locator("jolly-scope").first()).toHaveAttribute("theme", "light");

  await studio.openFromHome(MAP);
  await expect(studio.frames.locate("voxel-map").locator("jolly-scope").first())
    .toHaveAttribute("theme", "light", { timeout: 30_000 });
});

test("the shell console reaches the commands of the active editor only", async({ studio, commands }) => {
  test.slow();
  const lastEntry = commands.log.locator(".entry").last();
  await studio.openOffline();
  await studio.assets.open(MAP);
  await studio.frames.expectReady(studio.frames.only());

  await commands.submit("brush.size 3");
  await expect(lastEntry).toHaveText("3");
  await commands.submit("/help brush");
  await expect(lastEntry).toContainText("brush: Voxel brush");
  await commands.close();

  await studio.tabs.home.click();
  await commands.submit("/help brush");
  await expect(lastEntry).toContainText("Nothing is registered as \"brush\"");
});

test("the Search tool on home opens the shell console", async({ studio, page, commands }) => {
  await registerAccount(page.request);
  await studio.open();

  await studio.home.root
    .getByRole("button", { name: "Search", exact: true })
    .click();

  await expect(commands.prompt).toBeFocused();
});
