// Import Internal Dependencies
import type { BlockTransformJSON } from "../network/types.ts";

export function createBlockTransform(
  overrides: Partial<BlockTransformJSON> = {}
): BlockTransformJSON {
  return structuredClone({
    position: { x: 0, y: 0, z: 0 },
    pivotOffset: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    ...overrides
  });
}
