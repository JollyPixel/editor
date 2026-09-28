// Import Internal Dependencies
import type {
  BlockCollisionHint,
  BlockShape,
  BlockShapeID
} from "../../document/blocks/shape/BlockShape.ts";
import type { BlockShapeRegistry } from "../../document/blocks/shape/BlockShapeRegistry.ts";
import type { BlockRegistry } from "../../document/blocks/BlockRegistry.ts";
import type { ResolvedBlockDefinition } from "../../document/blocks/BlockDefinition.ts";
import type { FaceDefinition } from "../../document/blocks/face/index.ts";
import type { TilesetAtlases } from "../atlases/TilesetAtlases.ts";
import type { ResolvedTilesetDefinition } from "../../document/tilesets/types.ts";
import { FACES } from "../../document/geometry/faceDirection.ts";

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
  atlases: TilesetAtlases;
  alphaTest: number;
}

export function meshDefinitionsVersion(
  sources: MeshDefinitionSources
): string {
  const { blockRegistry, shapeRegistry, atlases } = sources;

  return `${blockRegistry.version}:${shapeRegistry.version}:${atlases.version}`;
}

export function captureMeshDefinitions(
  sources: MeshDefinitionSources
): MeshDefinitions {
  const {
    blockRegistry,
    shapeRegistry,
    atlases,
    alphaTest
  } = sources;
  const { tilesets } = atlases;
  const loaded: ResolvedTilesetDefinition[] = [];
  for (const { id } of tilesets) {
    const atlas = atlases.get(id);
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
