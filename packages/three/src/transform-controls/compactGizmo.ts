// Import Internal Dependencies
import type { TransformControlsOptions } from "./types.ts";

// CONSTANTS
export const COMPACT_GIZMO_APPEARANCE = {
  size: 0.1,
  center: {
    interactive: true
  },
  planes: {
    inset: 0.065,
    size: 0.3
  },
  flipTowardCamera: true,
  outline: {
    color: "#292a2c",
    width: 2.5
  }
} as const satisfies TransformControlsOptions["appearance"];
