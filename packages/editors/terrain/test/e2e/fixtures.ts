// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import {
  e2eFolder,
  editorFixture,
  openEditor
} from "@jolly-pixel/e2e/editor";
import {
  DEFAULT_MATERIAL_PROPERTIES,
  encodeHeights,
  encodeHoles,
  TERRAIN_FILE,
  GROUND_MATERIAL,
  TERRAIN_FILE_VERSION,
  TERRAIN_KIND
} from "@jolly-pixel/asset.terrain";
import {
  chunkResolution,
  CHUNK_SAMPLES,
  type ChunkTier
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { TerrainPage } from "./support/terrainPage.ts";

// CONSTANTS
export const TERRAIN_CHUNKS = 4;
export const STRIP_CHUNKS = { x: 20, z: 8 } as const;
export const REFINED_CHUNK = { x: 1, z: 1, tier: 4 } as const;
export const REFINED_DIP = 6;
export const REFINED_HOLE = { x: 100, z: 100, size: 4 } as const;
export const ROCK_MATERIAL = {
  ...DEFAULT_MATERIAL_PROPERTIES,
  id: "rock",
  slot: 1,
  name: "Rock"
};
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

interface RefinedChunk {
  readonly x: number;
  readonly z: number;
  readonly tier: 2 | 4;
}

function chunkHeights(
  chunkX: number,
  chunkZ: number,
  tier: ChunkTier
): string {
  const resolution = chunkResolution(tier);
  const heights = new Float32Array(resolution * resolution);
  for (let gridZ = 0; gridZ < resolution; gridZ++) {
    for (let gridX = 0; gridX < resolution; gridX++) {
      const between = gridX % tier !== 0 || gridZ % tier !== 0;
      heights[gridZ * resolution + gridX] = rollingHeight(
        chunkX * CHUNK_SAMPLES + gridX / tier,
        chunkZ * CHUNK_SAMPLES + gridZ / tier
      ) - (between ? REFINED_DIP : 0);
    }
  }

  return encodeHeights(heights);
}

function refinedHoles(
  chunkX: number,
  chunkZ: number,
  tier: ChunkTier
): string {
  const quads = chunkResolution(tier);
  const holes = new Uint8Array(quads * quads / 8);
  const first = {
    x: (REFINED_HOLE.x - chunkX * CHUNK_SAMPLES) * tier,
    z: (REFINED_HOLE.z - chunkZ * CHUNK_SAMPLES) * tier
  };
  for (let quadZ = first.z; quadZ < first.z + REFINED_HOLE.size * tier; quadZ++) {
    for (let quadX = first.x; quadX < first.x + REFINED_HOLE.size * tier; quadX++) {
      const index = quadZ * quads + quadX;
      holes[index >> 3] |= 1 << (index & 7);
    }
  }

  return encodeHoles(holes);
}

function encodeRollingTerrain(
  width: number,
  depth: number,
  refined: RefinedChunk | null
): Uint8Array {
  const chunks: Array<{ x: number; z: number; heights: string; tier?: 2 | 4; holes?: string; }> = [];
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const tier = refined?.x === x && refined.z === z ? refined.tier : null;
      chunks.push({
        x,
        z,
        heights: chunkHeights(x, z, tier ?? 1),
        ...(tier === null ? {} : { tier, holes: refinedHoles(x, z, tier) })
      });
    }
  }

  return TERRAIN_FILE.encode({
    version: TERRAIN_FILE_VERSION,
    chunks,
    materials: [GROUND_MATERIAL, ROCK_MATERIAL]
  });
}

function terrainFixture(
  width: number,
  depth: number,
  refined: RefinedChunk | null = null
) {
  return editorFixture({
    editor: EDITOR_OPTIONS,
    async create(catalog) {
      const id = await catalog.create(
        `${e2eFolder()}/world.terrain.json`,
        encodeRollingTerrain(width, depth, refined),
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
}

export const test = terrainFixture(TERRAIN_CHUNKS, TERRAIN_CHUNKS);
export const stripTest = terrainFixture(STRIP_CHUNKS.x, STRIP_CHUNKS.z);
export const refinedTest = terrainFixture(TERRAIN_CHUNKS, TERRAIN_CHUNKS, REFINED_CHUNK);
