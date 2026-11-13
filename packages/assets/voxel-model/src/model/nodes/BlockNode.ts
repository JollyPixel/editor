// Import Third-party Dependencies
import { randomId } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  BlockNodeJSON,
  BlockShapeJSON,
  BlockTransformJSON,
  MirrorAxes,
  UVLayoutData
} from "../types.ts";
import { BlockFlip } from "./BlockFlip.ts";
import { BlockShape } from "./BlockShape.ts";
import { BlockTransform } from "./BlockTransform.ts";
import { BlockUvLayouts } from "./BlockUvLayouts.ts";

export interface BlockNodeOptions {
  id?: string;
  name: string;
  parentId?: string | null;
  transform?: Partial<BlockTransformJSON>;
  flipAxes?: MirrorAxes;
  shape?: BlockShapeJSON;
  uv?: UVLayoutData;
  materialId?: string;
}

export interface StoredBlockFields {
  flipAxes?: unknown;
  shape?: unknown;
}

export type UpgradedBlock<T extends StoredBlockFields> = Omit<T, "flipAxes" | "shape"> & {
  flipAxes: NonNullable<T["flipAxes"]> | MirrorAxes;
  shape: NonNullable<T["shape"]> | BlockShapeJSON;
};

export class BlockNode {
  static create(
    options: BlockNodeOptions
  ): BlockNodeJSON {
    const {
      id = randomId(),
      name,
      parentId = null,
      transform,
      shape = BlockShape.box,
      uv = BlockUvLayouts.net(BlockUvLayouts.ORIGIN, shape),
      materialId
    } = options;

    return BlockNode.upgrade({
      kind: "block" as const,
      id,
      parentId,
      name,
      transform: BlockTransform.create(transform),
      ...(options.flipAxes === undefined ? {} : { flipAxes: { ...options.flipAxes } }),
      shape: { ...shape },
      uv,
      ...(materialId === undefined ? {} : { materialId })
    });
  }

  static upgrade<T extends StoredBlockFields>(
    stored: T
  ): UpgradedBlock<T> {
    const {
      flipAxes,
      shape,
      ...rest
    } = stored;

    return {
      ...rest,
      flipAxes: flipAxes ?? { ...BlockFlip.none },
      shape: shape ?? { ...BlockShape.box }
    };
  }
}
