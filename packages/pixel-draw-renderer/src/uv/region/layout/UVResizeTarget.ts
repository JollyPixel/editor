// Import Internal Dependencies
import type { UVSlot } from "../../geometry/types.ts";
import type { SelectionRect } from "../../../types.ts";

export type UVResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

export interface UVResizeTarget {
  id: string;
  slot: UVSlot | null;
  rect: SelectionRect;
  handles: readonly UVResizeHandle[];
}

export type UVLayoutResizeTarget = Omit<UVResizeTarget, "id">;

export const UV_EVERY_RESIZE_HANDLE: readonly UVResizeHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw"
];

export const UV_NET_RESIZE_HANDLES: readonly UVResizeHandle[] = ["e", "s"];
