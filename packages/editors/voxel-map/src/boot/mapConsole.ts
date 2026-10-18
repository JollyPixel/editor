// Import Third-party Dependencies
import {
  registerConsoleFeatures,
  type CommandConsole,
  type ConsoleFeature,
  type RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import { brushConsole } from "../features/painting/brushConsole.ts";
import { keybindsConsole } from "../keybindings/keybindsConsole.ts";
import {
  textureConsole,
  textureShortcutsConsole
} from "../features/texture/textureConsole.ts";
import { viewConsole } from "../scene/viewConsole.ts";
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";

// CONSTANTS
const kFeatures: readonly ConsoleFeature<MapConsoleContext>[] = [
  brushConsole,
  keybindsConsole,
  textureConsole,
  textureShortcutsConsole,
  viewConsole
];

export type MapConsoleContext = Pick<VoxelMapWorkspace, "state">;

export function mapConsole(
  commands: CommandConsole,
  context: MapConsoleContext
): RegistrationHandle {
  return registerConsoleFeatures(commands, kFeatures, context);
}
