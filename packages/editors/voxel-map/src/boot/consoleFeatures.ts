// Import Third-party Dependencies
import type { ConsoleFeature } from "@jolly-pixel/console";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import { brushConsole } from "../features/painting/brushConsole.ts";

export const CONSOLE_FEATURES: readonly ConsoleFeature<VoxelMapWorkspace>[] = [
  brushConsole
];
