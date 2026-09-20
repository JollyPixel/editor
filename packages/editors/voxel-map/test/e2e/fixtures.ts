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
import { tilesetAsset } from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import { SOCKET_URL } from "./constants.ts";
import {
  encodeTilesetDocument,
  encodeWorldDocument,
  readDefaultTileset
} from "../../vite/worldSeed.ts";

export { expect } from "@playwright/test";

// CONSTANTS
const kWorldKind = "voxelmap";
const kUsernameStorageKey = "jolly-pixel:username";
const kMaxFps = 10;

export interface E2EWorld {
  id: string;
  tilesetId: string;
}

export interface OpenEditorOptions {
  username?: string;
  maxFps?: number;
}

export async function createWorld(): Promise<E2EWorld> {
  const client = new network.Client({
    url: SOCKET_URL
  });
  const catalog = new CatalogClient(catalogRoom(client));

  try {
    await catalog.ready;

    return await createWorldIn(catalog);
  }
  finally {
    catalog.dispose();
    client.destroy();
  }
}

async function createWorldIn(
  catalog: CatalogClient
): Promise<E2EWorld> {
  const folder = `e2e/${crypto.randomUUID()}`;
  const tileset = await readDefaultTileset("");
  const tilesetId = await catalog.create(
    `${folder}/tileset.pixelart`,
    encodeTilesetDocument(tileset),
    { kind: PIXEL_ART_KIND }
  );
  const id = await catalog.create(
    `${folder}/world.voxelmap.json`,
    encodeWorldDocument({
      ...tileset.definition,
      asset: tilesetAsset(tilesetId)
    }),
    { kind: kWorldKind }
  );

  return {
    id,
    tilesetId
  };
}

export async function openEditor(
  page: Page,
  world: E2EWorld,
  options: OpenEditorOptions = {}
): Promise<void> {
  const {
    username = "E2E",
    maxFps = kMaxFps
  } = options;

  await page.addInitScript((entry) => {
    sessionStorage.setItem(entry.key, entry.username);
  }, {
    key: kUsernameStorageKey,
    username
  });
  const query = new URLSearchParams({
    target: world.id,
    "max-fps": String(maxFps),
    samples: "0"
  });
  await page.goto(`/?${query}`);
  await waitForEditor(page);
}

export async function waitForEditor(
  page: Page
): Promise<void> {
  await page.waitForFunction(
    () => window.voxelMapEditor?.workspace.mapDocument.ready === true
  );
}

export const test = base.extend<{
  world: E2EWorld;
}>({
  world: [
    async({ page }, use) => {
      const world = await createWorld();
      await openEditor(page, world);
      await use(world);
    },
    { auto: true }
  ]
});
