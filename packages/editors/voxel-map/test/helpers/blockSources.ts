// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockShapeRegistry,
  TilesetList,
  TilesetAtlases,
  resolveBlockDefinition,
  type BlockDefinition,
  type TilesetImage
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "../../src/features/blocks/blockGeometry.ts";
import { TileOpacityProbe } from "../../src/features/blocks/tileOpacity.ts";

export function sourcesOf(
  atlases: TilesetAtlases
): BlockRenderSources {
  return {
    shapeRegistry: BlockShapeRegistry.createDefault(),
    atlases,
    tileOpacity: new TileOpacityProbe(atlases, () => {
      const data = new Uint8ClampedArray(4 * 2 * 4);
      for (let index = 0; index < data.length; index += 4) {
        data[index + 3] = (index / 4) % 4 < 2 ? 255 : 0;
      }

      return {
        width: 4,
        height: 2,
        data
      };
    })
  };
}

export function texturedSources(): BlockRenderSources {
  const atlases = new TilesetAtlases({
    tilesets: new TilesetList([
      {
        id: "atlas",
        src: "atlas.png",
        tileSize: 2
      }
    ])
  });
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 2;
  atlases.registerTexture(
    "atlas",
    new THREE.Texture<TilesetImage>(canvas)
  );

  return sourcesOf(atlases);
}

export function blockOf(
  patch: Partial<BlockDefinition>
) {
  return resolveBlockDefinition({
    id: 1,
    name: "Block",
    shapeId: "cube",
    ...patch
  });
}
