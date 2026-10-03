// Import Third-party Dependencies
import { expect, test } from "@playwright/test";
import { treeRow } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  assetAction,
  assetMenu,
  editorFrames,
  expectEditorReady,
  homeTab,
  MODEL,
  openFromHome,
  openShell,
  renameField,
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

test("creates a map, a model and a texture from the tree and opens each", async({ page }) => {
  test.slow();
  await openShell(page);
  const assets = [
    {
      kind: "New voxel map",
      file: "New voxel map.voxelmap.json",
      companion: "New voxel map.tileset.json",
      editor: "voxel-map"
    },
    {
      kind: "New voxel model",
      file: "New voxel model.voxelmodel.json",
      companion: "New voxel model.pixelart",
      editor: "voxel-model"
    },
    {
      kind: "New pixel art",
      file: "New pixel art.pixelart",
      companion: null,
      editor: "pixel-art"
    }
  ];

  for (const asset of assets) {
    await assetAction(page, "New asset").click();
    await assetMenu(page).getByRole("menuitem", { name: asset.kind }).click();
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
