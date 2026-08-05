// Import Internal Dependencies
import type { TilesetDefinition } from "../../src/tileset/types.ts";

/** A 4x4, 16px-tile atlas definition, matching the fixture registered by mockTexture()'s default 64x64 size. */
export function makeAtlasDef(
  overrides: Partial<TilesetDefinition> = {}
): TilesetDefinition {
  return {
    id: "atlas",
    src: "/atlas.png",
    tileSize: 16,
    cols: 4,
    rows: 4,
    ...overrides
  };
}
