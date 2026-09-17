// Import Internal Dependencies
import type {
  TilesetAtlas,
  TilesetDefinition,
  TilesetManager
} from "../../src/tileset/index.ts";
import { mockTexture } from "./mockTexture.ts";

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

export function registerAtlas(
  manager: TilesetManager,
  def: TilesetDefinition = makeAtlasDef(),
  texture = mockTexture()
): TilesetAtlas {
  manager.tilesets.add(def);

  return manager.registerTexture(def.id, texture);
}
