// Import Node.js Dependencies
import crypto from "node:crypto";

// Import Third-party Dependencies
import {
  test as base,
  type Page
} from "@playwright/test";
import * as network from "@jolly-pixel/network/client";
import {
  CatalogClient,
  catalogRoom
} from "@jolly-pixel/asset-server/catalog/client";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model";

// Import Internal Dependencies
import { SOCKET_URL } from "./constants.ts";
import {
  encodeModelDocument,
  encodeTextureDocument
} from "../../vite/modelSeed.ts";

export { expect } from "@playwright/test";

// CONSTANTS
const kMaxFps = 5;

export interface E2EModel {
  id: string;
  textureId: string;
}

export interface OpenEditorOptions {
  username?: string;
  maxFps?: number;
}

export async function createModel(): Promise<E2EModel> {
  const client = new network.Client({
    url: SOCKET_URL
  });
  const catalog = new CatalogClient(catalogRoom(client));

  try {
    await catalog.ready;

    return await createModelIn(catalog);
  }
  finally {
    catalog.dispose();
    client.destroy();
  }
}

async function createModelIn(
  catalog: CatalogClient
): Promise<E2EModel> {
  const folder = `e2e/${crypto.randomUUID()}`;
  const textureId = await catalog.create(
    `${folder}/model.pixelart`,
    encodeTextureDocument(),
    { kind: PIXEL_ART_KIND }
  );
  const id = await catalog.create(
    `${folder}/model.voxelmodel.json`,
    encodeModelDocument(textureId),
    { kind: VOXEL_MODEL_KIND }
  );

  return {
    id,
    textureId
  };
}

export async function openEditor(
  page: Page,
  model: E2EModel,
  options: OpenEditorOptions = {}
): Promise<void> {
  const {
    username = "E2E",
    maxFps = kMaxFps
  } = options;

  const query = new URLSearchParams({
    target: model.id,
    username,
    "max-fps": String(maxFps)
  });
  await page.goto(`/?${query}`);
  await waitForEditor(page);
}

export async function waitForEditor(
  page: Page
): Promise<void> {
  await page.waitForFunction(() => {
    const state = document.documentElement.dataset.editorState;
    if (state === "failed") {
      throw new Error("The editor failed to boot.");
    }

    return state === "ready";
  });
}

export const test = base.extend<{
  model: E2EModel;
}>({
  model: [
    async({ page }, use) => {
      const model = await createModel();
      await openEditor(page, model);
      await use(model);
    },
    { auto: true }
  ]
});
