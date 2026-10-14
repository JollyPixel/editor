// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockShapeRegistry,
  BlocksetAtlases,
  BlocksetList,
  MaterialGroupList,
  type AtlasImage
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockRenderSources } from "../../../../src/features/blocks/rendering/BlockRenderSources.ts";

function sourcesWithGroups() {
  const atlases = new BlocksetAtlases({
    blocksets: new BlocksetList([
      {
        id: "atlas",
        src: "atlas.png",
        tileSize: 2
      }
    ])
  });
  const materialGroups = new MaterialGroupList();

  return {
    atlases,
    materialGroups,
    sources: new BlockRenderSources({
      shapes: BlockShapeRegistry.createDefault(),
      atlases,
      materialGroups
    })
  };
}

describe("BlockRenderSources.watchChanges", () => {
  it("reports each change once, the atlases before the material groups", () => {
    const { atlases, materialGroups, sources } = sourcesWithGroups();
    const changes = sources.watchChanges();
    assert.equal(changes.poll(), null);

    atlases.registerTexture(
      "atlas",
      new THREE.Texture<AtlasImage>(document.createElement("canvas"))
    );
    materialGroups.define({
      id: "gold",
      metalness: 1
    });
    assert.equal(changes.poll(), "atlases");
    assert.equal(changes.poll(), null);

    materialGroups.define({
      id: "gold",
      metalness: 0.5
    });
    assert.equal(changes.poll(), "materialGroups");
    assert.equal(changes.poll(), null);
  });
});
