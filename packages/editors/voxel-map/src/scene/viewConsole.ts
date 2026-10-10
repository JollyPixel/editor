// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import type { Grid } from "@jolly-pixel/three";
import type {
  VoxelInspector,
  VoxelInspectorMode
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kInspectorModes = [
  "off",
  "overlay",
  "wireframe"
] as const satisfies readonly VoxelInspectorMode[];

export interface ViewConsoleContext {
  grid: Pick<Grid, "enabled">;
  inspector: Pick<VoxelInspector, "mode" | "chunkBounds">;
}

export function viewConsole(
  commands: CommandConsole,
  { grid, inspector }: ViewConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("view", {
    description: "Viewport aids"
  });

  namespace.registerVariable("grid", {
    type: "boolean",
    description: "Ground grid under the map",
    get: () => grid.enabled,
    set: (enabled) => {
      grid.enabled = enabled;
    }
  });
  namespace.registerVariable("inspector", {
    type: "enum",
    description: "Chunk wireframe over the blocks, or wireframe only",
    enumValues: kInspectorModes,
    get: () => inspector.mode,
    set: (mode) => {
      inspector.mode = mode;
    }
  });
  namespace.registerVariable("chunkBounds", {
    type: "boolean",
    description: "Outline the bounds of every chunk",
    get: () => inspector.chunkBounds,
    set: (chunkBounds) => {
      inspector.chunkBounds = chunkBounds;
    }
  });

  return namespace;
}
