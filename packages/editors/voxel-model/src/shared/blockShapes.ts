// Import Third-party Dependencies
import type {
  IconName,
  JollyOption
} from "@jolly-pixel/ui";
import {
  BlockShape,
  type BlockShapeJSON
} from "@jolly-pixel/asset.voxel-model/client";

export interface BlockShapeEntry {
  id: string;
  shape: BlockShapeJSON;
  label: string;
  icon: IconName;
}

export const BLOCK_SHAPES = [
  {
    id: "box",
    shape: BlockShape.create("box"),
    label: "Box",
    icon: "block"
  },
  {
    id: "plane",
    shape: BlockShape.create("plane"),
    label: "Plane",
    icon: "shape-plane"
  },
  {
    id: "cylinder",
    shape: BlockShape.create("cylinder"),
    label: "Cylinder",
    icon: "shape-cylinder"
  },
  {
    id: "cone",
    shape: BlockShape.create("cone"),
    label: "Cone",
    icon: "shape-cone"
  },
  {
    id: "pyramid",
    shape: { type: "cone", sides: 4 },
    label: "Pyramid",
    icon: "shape-pyramid"
  },
  {
    id: "torus",
    shape: BlockShape.create("torus"),
    label: "Torus",
    icon: "shape-torus"
  }
] as const satisfies readonly BlockShapeEntry[];

export type KnownBlockShape = typeof BLOCK_SHAPES[number];
export type BlockShapeEntryId = KnownBlockShape["id"];

export const BLOCK_SHAPE_OPTIONS: readonly JollyOption<BlockShapeEntryId>[] = BLOCK_SHAPES.map(
  ({ id, label, icon }) => {
    return {
      value: id,
      label,
      icon
    };
  }
);

export function blockShapeById(
  id: string | undefined
): KnownBlockShape {
  const entry = BLOCK_SHAPES.find((each) => each.id === id);
  if (entry === undefined) {
    throw new Error(`No block shape entry with the id "${id}".`);
  }

  return entry;
}

export function matchBlockShapeEntry(
  shape: BlockShapeJSON
): KnownBlockShape {
  const entry = BLOCK_SHAPES.find((each) => BlockShape.same(each.shape, shape)) ??
    BLOCK_SHAPES.find((each) => each.shape.type === shape.type);
  if (entry === undefined) {
    throw new Error(`No block shape entry for "${shape.type}".`);
  }

  return entry;
}
