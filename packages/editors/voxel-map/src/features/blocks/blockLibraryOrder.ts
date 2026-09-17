// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { ToolOption } from "../../shared/toolChoice.ts";
import { sortBlocksByUsage } from "./blockUsage.ts";

// CONSTANTS
export const DEFAULT_BLOCK_LIBRARY_ORDER: BlockLibraryOrder = "registry";

export const BLOCK_LIBRARY_ORDERS: readonly ToolOption<BlockLibraryOrder>[] = [
  { value: "registry", icon: "order-registry", label: "Library order" },
  { value: "usage", icon: "order-usage", label: "Most used first" }
];

export type BlockLibraryOrder = "registry" | "usage";

export function parseBlockLibraryOrder(
  value: string | null
): BlockLibraryOrder {
  return BLOCK_LIBRARY_ORDERS.find((option) => option.value === value)?.value ??
    DEFAULT_BLOCK_LIBRARY_ORDER;
}

export function isReorderable(
  order: BlockLibraryOrder
): boolean {
  return order === "registry";
}

export function orderBlocks(
  blocks: ResolvedBlockDefinition[],
  order: BlockLibraryOrder,
  counts: ReadonlyMap<number, number>
): ResolvedBlockDefinition[] {
  switch (order) {
    case "usage":
      return sortBlocksByUsage(blocks, counts);
    default:
      return blocks;
  }
}
