// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import {
  EditorToolbar,
  e2eFolder,
  followEditor,
  withCatalog
} from "@jolly-pixel/e2e/editor";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model";
import {
  createPixelArtFile,
  encodePixelArtFile
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  test,
  expect,
  type E2EModel
} from "../fixtures.ts";
import {
  encodeModelFile,
  TEXTURE_SIZE
} from "../../../src/boot/modelProject.ts";

interface OpenedModel {
  modelId: string;
  paintsTexture: boolean;
}

function openedModel(
  page: Page,
  textureId: string
): Promise<OpenedModel> {
  return page.evaluate((id) => {
    const { session } = window.voxelModelEditor!;
    const panel = document
      .querySelector("jolly-model-editor-left-panel")
      ?.shadowRoot
      ?.querySelector("pixel-draw-panel");

    return {
      modelId: session.target.record.id,
      paintsTexture: panel?.canvasManager?.document ===
        session.dependency(id)?.document
    };
  }, textureId);
}

test("the Asset select opens another model and its texture in place", async({ page, target, baseURL }) => {
  const folder = e2eFolder();
  const other: E2EModel = await withCatalog(baseURL!, async(catalog) => {
    const textureId = await catalog.create(
      `${folder}/other.pixelart`,
      encodePixelArtFile(createPixelArtFile(TEXTURE_SIZE)),
      { kind: PIXEL_ART_KIND }
    );
    const id = await catalog.create(
      `${folder}/other.voxelmodel.json`,
      encodeModelFile(textureId),
      { kind: VOXEL_MODEL_KIND }
    );

    return {
      id,
      textureId
    };
  });
  const editorToolbar = new EditorToolbar(page);
  const pageLoad = await page.evaluate(() => performance.timeOrigin);

  await editorToolbar.openAsset(`${folder}/other`);
  await followEditor(page, (url) => url.searchParams.get("target") === other.id);
  await expect.poll(() => openedModel(page, other.textureId)).toEqual({
    modelId: other.id,
    paintsTexture: true
  });

  await page.goBack();
  await expect.poll(() => openedModel(page, target.textureId)).toEqual({
    modelId: target.id,
    paintsTexture: true
  });
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(pageLoad);
});
