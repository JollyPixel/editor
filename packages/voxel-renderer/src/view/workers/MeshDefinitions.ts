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
import type { BlocksetAtlases } from "../atlases/BlocksetAtlases.ts";
import type { ResolvedBlocksetDefinition } from "../../document/blocksets/types.ts";
import type { BlendGroupJSON } from "../../document/materials/BlendGroup.ts";
import type { BlendGroupList } from "../../document/materials/BlendGroupList.ts";
import { FACES } from "../../document/geometry/faceDirection.ts";
import type { FaceRegionAssignment } from "../meshing/pulling/FaceRegionTable.ts";

export interface MeshShapeDefinition {
  id: BlockShapeID;
  faces: FaceDefinition[];
  occludedFaces: number;
  collisionHint: BlockCollisionHint;
}

export interface MeshBlocksetDefinitions {
  defaultBlocksetId: string | null;
  declared: string[];
  loaded: ResolvedBlocksetDefinition[];
}

export interface MeshDefinitions {
  blocks: ResolvedBlockDefinition[];
  shapes: MeshShapeDefinition[];
  blocksets: MeshBlocksetDefinitions;
  blendGroups: BlendGroupJSON[];
  alphaTest: number;
  regions: FaceRegionAssignment[];
}

export interface MeshDefinitionSources {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  atlases: BlocksetAtlases;
  blendGroups?: BlendGroupList;
  alphaTest: number;
}

export function meshDefinitionsVersion(
  sources: MeshDefinitionSources
): string {
  const {
    blockRegistry,
    shapeRegistry,
    atlases,
    blendGroups
  } = sources;

  return `${blockRegistry.version}:${shapeRegistry.version}:${atlases.version}:` +
    `${blendGroups?.version ?? 0}`;
}

export function captureMeshDefinitions(
  sources: MeshDefinitionSources,
  regions: Iterable<FaceRegionAssignment> = []
): MeshDefinitions {
  const {
    blockRegistry,
    shapeRegistry,
    atlases,
    blendGroups,
    alphaTest
  } = sources;
  const { blocksets } = atlases;
  const loaded: ResolvedBlocksetDefinition[] = [];
  for (const { id } of blocksets) {
    const atlas = atlases.get(id);
    if (atlas !== undefined) {
      loaded.push(atlas.def);
    }
  }

  return {
    blocks: [...blockRegistry],
    shapes: [...shapeRegistry].map(describeShape),
    blocksets: {
      defaultBlocksetId: blocksets.defaultBlocksetId,
      declared: [...blocksets.ids()],
      loaded
    },
    blendGroups: blendGroups?.toJSON() ?? [],
    alphaTest,
    regions: [...regions]
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
