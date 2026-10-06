// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import {
  BRUSH_AXES,
  BRUSH_MAX_SIZE,
  BRUSH_MIN_SIZE,
  BRUSH_MODES,
  BRUSH_PATTERNS,
  ROTATION_MODES,
  type RotationMode
} from "./BrushStore.ts";
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";

// CONSTANTS
const kRotationValues = ROTATION_MODES.map(rotationValue);

export function brushConsole(
  commands: CommandConsole,
  { brush }: Pick<VoxelMapWorkspace, "brush">
): RegistrationHandle {
  const namespace = commands.registerNamespace("brush", {
    description: "Voxel brush"
  });

  namespace.registerVariable("size", {
    type: "number",
    description: `Brush size in voxels, from ${BRUSH_MIN_SIZE} to ${BRUSH_MAX_SIZE}`,
    get: () => brush.size,
    set: (size) => {
      brush.size = size;
    }
  });
  namespace.registerVariable("mode", {
    type: "enum",
    description: "Build places blocks, replace repaints occupied cells",
    enumValues: BRUSH_MODES,
    get: () => brush.mode,
    set: (mode) => {
      brush.mode = mode;
    }
  });
  namespace.registerVariable("axis", {
    type: "enum",
    description: "Plane or volume the brush spreads over",
    enumValues: BRUSH_AXES,
    get: () => brush.axis,
    set: (axis) => {
      brush.axis = axis;
    }
  });
  namespace.registerVariable("pattern", {
    type: "enum",
    description: "Brush footprint shape",
    enumValues: BRUSH_PATTERNS,
    get: () => brush.pattern,
    set: (pattern) => {
      brush.pattern = pattern;
    }
  });
  namespace.registerVariable("rotationMode", {
    type: "enum",
    description: "Block rotation, auto or degrees counter-clockwise",
    enumValues: kRotationValues,
    get: () => rotationValue(brush.rotationMode),
    set: (value) => {
      const mode = ROTATION_MODES.find(
        (known) => rotationValue(known) === value
      );
      if (mode === undefined) {
        return false;
      }

      brush.rotationMode = mode;

      return undefined;
    }
  });
  namespace.registerVariable("flipY", {
    type: "boolean",
    description: "Place blocks upside down",
    get: () => brush.flipY,
    set: (flipY) => {
      brush.flipY = flipY;
    }
  });
  namespace.registerVariable("ghost", {
    type: "boolean",
    description: "Preview the block under the cursor, at size 1 only",
    get: () => brush.ghost,
    set: (ghost) => {
      brush.ghost = ghost;
    }
  });

  return namespace;
}

function rotationValue(
  mode: RotationMode
): string {
  return mode === "auto" ? mode : String(mode * 90);
}
