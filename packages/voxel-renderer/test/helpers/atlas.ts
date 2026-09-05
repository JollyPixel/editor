// Import Internal Dependencies
import type { TilesetDefinition } from "../../src/tileset/index.ts";

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
