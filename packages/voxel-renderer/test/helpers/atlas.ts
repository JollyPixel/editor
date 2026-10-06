// Import Internal Dependencies
import type { BlocksetAtlas, BlocksetAtlases } from "../../src/view/atlases/index.ts";
import type { BlocksetDefinition } from "../../src/document/blocksets/index.ts";
import { mockTexture } from "./mockTexture.ts";

export function makeAtlasDef(
  overrides: Partial<BlocksetDefinition> = {}
): BlocksetDefinition {
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
  manager: BlocksetAtlases,
  def: BlocksetDefinition = makeAtlasDef(),
  texture = mockTexture()
): BlocksetAtlas {
  manager.blocksets.add(def);

  return manager.registerTexture(def.id, texture);
}
