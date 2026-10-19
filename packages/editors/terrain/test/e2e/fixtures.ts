// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import {
  e2eFolder,
  editorFixture,
  openEditor
} from "@jolly-pixel/e2e/editor";
import {
  encodeHeights,
  encodeTerrainAssetDocument,
  TERRAIN_DOCUMENT_VERSION,
  TERRAIN_KIND
} from "@jolly-pixel/asset.terrain";
import {
  CHUNK_SAMPLE_COUNT,
  CHUNK_SAMPLES
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { TerrainPage } from "./support/terrainPage.ts";

// CONSTANTS
export const TERRAIN_CHUNKS = 4;
export const EDITOR_OPTIONS = {
  maxFps: 30,
  query: {
    samples: "0",
    render: "on-demand"
  }
};

export { expect } from "@playwright/test";

export function rollingHeight(
  sampleX: number,
  sampleZ: number
): number {
  const hills = 14 * Math.sin(sampleX / 23) + 10 * Math.cos(sampleZ / 17);

  return hills + 9 * Math.sin(sampleX * 1.7) * Math.cos(sampleZ * 1.3);
}

function chunkHeights(
  chunkX: number,
  chunkZ: number
): string {
  const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
  for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
    for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
      heights[localZ * CHUNK_SAMPLES + localX] = rollingHeight(
        chunkX * CHUNK_SAMPLES + localX,
        chunkZ * CHUNK_SAMPLES + localZ
      );
    }
  }

  return encodeHeights(heights);
}

function encodeRollingTerrain(): Uint8Array {
  const chunks: Array<{ x: number; z: number; heights: string; }> = [];
  for (let z = 0; z < TERRAIN_CHUNKS; z++) {
    for (let x = 0; x < TERRAIN_CHUNKS; x++) {
      chunks.push({
        x,
        z,
        heights: chunkHeights(x, z)
      });
    }
  }

  return encodeTerrainAssetDocument({
    version: TERRAIN_DOCUMENT_VERSION,
    chunks
  });
}

export const test = editorFixture({
  editor: EDITOR_OPTIONS,
  async create(catalog) {
    const id = await catalog.create(
      `${e2eFolder()}/world.terrain.json`,
      encodeRollingTerrain(),
      { kind: TERRAIN_KIND }
    );

    return { id };
  }
}).extend<{
  terrain: TerrainPage;
  peerTerrain: TerrainPage;
  farPeer: Page;
}>({
  terrain: async({ page }, use) => {
    await use(new TerrainPage(page));
  },
  peerTerrain: async({ peer }, use) => {
    await use(new TerrainPage(peer));
  },
  farPeer: async({ browser, editor, target }, use) => {
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      await openEditor(page, {
        ...editor,
        target: target.id,
        username: "Far"
      });
      await use(page);
    }
    finally {
      await context.close();
    }
  }
});
