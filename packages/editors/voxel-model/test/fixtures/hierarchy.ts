// Import Third-party Dependencies
import {
  BlockTransform,
  type VoxelModelCommand
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  ModelHierarchy,
  type HierarchyNode
} from "#src/model/index.ts";
import { createEditorHistory } from "#src/features/history/index.ts";
import {
  recordBuildEdits,
  createModelFixture,
  type ModelFixture
} from "./model.ts";
import {
  modelAccess,
  type TestModelAccess
} from "./modelAccess.ts";

// CONSTANTS
export const NO_MIRROR = { x: false, y: false, z: false };
const kTextureSize = { x: 256, y: 256 };

export interface HierarchyFixture extends ModelFixture {
  access: TestModelAccess;
  hierarchy: ModelHierarchy;
  commands: VoxelModelCommand[];
}

export function createHierarchy(
  fixture: ModelFixture,
  access: TestModelAccess
): ModelHierarchy {
  return new ModelHierarchy({
    document: fixture.document,
    edits: recordBuildEdits(createEditorHistory({ document: fixture.document })),
    textureSize: () => kTextureSize,
    poses: fixture.blocks,
    access
  });
}

export function createHierarchyFixture(): HierarchyFixture {
  const fixture = createModelFixture();
  const commands: VoxelModelCommand[] = [];
  fixture.document.on("change", (change) => commands.push(change.command));
  const access = modelAccess();

  return {
    ...fixture,
    access,
    hierarchy: createHierarchy(fixture, access),
    commands
  };
}

export function readShape(
  nodes: readonly HierarchyNode[]
): unknown[] {
  return nodes.map((node) => (
    node.children.length > 0 ? [node.name, readShape(node.children)] : node.name
  ));
}

export function at(
  x: number,
  y = 0,
  z = 0
) {
  return BlockTransform.create({
    position: { x, y, z }
  });
}
