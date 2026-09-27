// Import Internal Dependencies
import type {
  BlockCollisionHint,
  BlockShape,
  BlockShapeID
} from "../../blocks/shape/BlockShape.ts";
import type { BlockShapeRegistry } from "../../blocks/shape/BlockShapeRegistry.ts";
import type { BlockRegistry } from "../../blocks/BlockRegistry.ts";
import type { ResolvedBlockDefinition } from "../../blocks/BlockDefinition.ts";
import type { FaceDefinition } from "../../blocks/face/index.ts";
import type { TilesetManager } from "../../tileset/TilesetManager.ts";
import type { ResolvedTilesetDefinition } from "../../tileset/types.ts";
import { FACES } from "../../utils/math.ts";

export interface MeshShapeDefinition {
  id: BlockShapeID;
  faces: FaceDefinition[];
  occludedFaces: number;
  collisionHint: BlockCollisionHint;
}

export interface MeshTilesetDefinitions {
  defaultTilesetId: string | null;
  declared: string[];
  loaded: ResolvedTilesetDefinition[];
}

export interface MeshDefinitions {
  blocks: ResolvedBlockDefinition[];
  shapes: MeshShapeDefinition[];
  tilesets: MeshTilesetDefinitions;
  alphaTest: number;
}

export interface MeshDefinitionSources {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
  alphaTest: number;
}

export function meshDefinitionsVersion(
  sources: MeshDefinitionSources
): string {
  const { blockRegistry, shapeRegistry, tilesetManager } = sources;

  return `${blockRegistry.version}:${shapeRegistry.version}:${tilesetManager.version}`;
}

export function captureMeshDefinitions(
  sources: MeshDefinitionSources
): MeshDefinitions {
  const {
    blockRegistry,
    shapeRegistry,
    tilesetManager,
    alphaTest
  } = sources;
  const { tilesets } = tilesetManager;
  const loaded: ResolvedTilesetDefinition[] = [];
  for (const { id } of tilesets) {
    const atlas = tilesetManager.get(id);
    if (atlas !== undefined) {
      loaded.push(atlas.def);
    }
  }

  return {
    blocks: [...blockRegistry],
    shapes: [...shapeRegistry].map(describeShape),
    tilesets: {
      defaultTilesetId: tilesets.defaultTilesetId,
      declared: [...tilesets.ids()],
      loaded
    },
    alphaTest
  };
}

function describeShape(
  shape: BlockShape
): MeshShapeDefinition {
  let occludedFaces = 0;
  for (const face of FACES) {
    if (shape.occludes(face)) {
      occludedFaces |= 1 << face;
    }
  }

  return {
    id: shape.id,
    faces: [...shape.faces],
    occludedFaces,
    collisionHint: shape.collisionHint
  };
}
