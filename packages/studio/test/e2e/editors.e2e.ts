// Import Third-party Dependencies
import { expect, test } from "@playwright/test";
import { treeRow } from "@jolly-pixel/e2e";
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  assetAction,
  assetMenu,
  assetRows,
  editorFrames,
  expectEditorReady,
  homeTab,
  MAP,
  MODEL,
  openFromHome,
  openShell,
  renameField,
  SEED_ROW_COUNT,
  TEXTURE
} from "./support/shell.ts";

test("opens a pixel-art texture in the pixel-art editor page", async({ page }) => {
  await openShell(page);
  await treeRow(page, TEXTURE).dblclick();

  const frame = editorFrames(page);
  await expect(frame).toHaveAttribute(
    "src",
    /^editors\/pixel-art\/\?.*target=model-texture/
  );
  const editor = frame.contentFrame();
  await expectEditorReady(editor);
  await expect(editor.locator("pixel-draw-panel")).toBeVisible();
});

test("editor frames read the catalog through the shell", async({ page }) => {
  const catalogJoins: unknown[] = [];
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      const envelope = typeof payload === "string" ? JSON.parse(payload) : null;
      if (envelope?.room === CATALOG_ROOM && envelope.kind === "join") {
        catalogJoins.push(envelope);
      }
    });
  });
  await page.goto("/?username=Guest");
  await expect(assetRows(page)).toHaveCount(SEED_ROW_COUNT);

  await treeRow(page, MODEL).dblclick();
  await expectEditorReady(editorFrames(page).contentFrame());

  expect(catalogJoins).toHaveLength(1);
});

test("creates a map, a model and a texture from the tree and opens each", async({ page }) => {
  test.slow();
  await openShell(page);
  const assets = [
    {
      kind: "Voxel map",
      file: "New voxel map.voxelmap.json",
      companion: "New voxel map.tileset.json",
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
    }
  ];

  for (const asset of assets) {
    await assetAction(page, "New asset").click();
    await assetMenu(page).getByRole("menuitem", { name: asset.kind, exact: true }).click();
    await expect(renameField(page)).toHaveValue(asset.file);
    await renameField(page).press("Escape");

    if (asset.companion !== null) {
      await expect(treeRow(page, asset.companion)).toBeVisible();
    }

    await treeRow(page, asset.file).dblclick();
    await expectEditorReady(
      page.locator(`#editor-frames iframe[src^="editors/${asset.editor}/"]`).contentFrame()
    );
    await homeTab(page).click();
  }
});

test("an editor frame opens the shell console, which themes every frame", async({ page }) => {
  test.slow();
  await openShell(page);
  await treeRow(page, TEXTURE).dblclick();
  const texture = editorFrames(page).contentFrame();
  await expectEditorReady(texture);
  await expect(texture.locator("jolly-console")).toHaveCount(0);

  await texture.locator("pixel-draw-panel")
    .getByRole("button")
    .first()
    .focus();
  await page.keyboard.press("Control+k");
  const prompt = page.getByRole("combobox", { name: "Command" });
  await expect(prompt).toBeFocused();
  await prompt.fill("theme light");
  await prompt.press("Enter");
  await page.keyboard.press("Escape");

  await expect(page.locator("jolly-scope").first()).toHaveAttribute("theme", "light");
  await expect(texture.locator("jolly-scope").first()).toHaveAttribute("theme", "light");

  await openFromHome(page, MODEL);
  const model = page.locator("#editor-frames iframe[src*='voxel-model']").contentFrame();
  await expect(model.locator("jolly-scope").first())
    .toHaveAttribute("theme", "light", { timeout: 30_000 });
});

test("the shell console reaches the commands of the active editor only", async({ page }) => {
  test.slow();
  await openShell(page);
  await treeRow(page, MAP).dblclick();
  await expectEditorReady(editorFrames(page).contentFrame());
  const prompt = page.getByRole("combobox", { name: "Command" });
  const lastEntry = page.getByRole("log").locator(".entry").last();

  await page.keyboard.press("Control+k");
  await prompt.fill("brush.size 3");
  await prompt.press("Enter");
  await expect(lastEntry).toHaveText("3");
  await prompt.fill("/help brush");
  await prompt.press("Enter");
  await expect(lastEntry).toContainText("brush.axis");
  await page.keyboard.press("Escape");

  await homeTab(page).click();
  await page.keyboard.press("Control+k");
  await prompt.fill("/help brush");
  await prompt.press("Enter");
  await expect(lastEntry).toContainText("Nothing is registered as \"brush\"");
});
