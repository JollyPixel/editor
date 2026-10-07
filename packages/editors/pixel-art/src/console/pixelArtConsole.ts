// Import Third-party Dependencies
import {
  registerConsoleFeatures,
  type CommandConsole,
  type ConsoleFeature,
  type RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import {
  keybindConsole,
  type KeybindConsoleContext
} from "../keybindings/keybindConsole.ts";

// CONSTANTS
const kFeatures: readonly ConsoleFeature<PixelArtConsoleContext>[] = [
  keybindConsole
];

export type PixelArtConsoleContext = KeybindConsoleContext;

export function pixelArtConsole(
  commands: CommandConsole,
  context: PixelArtConsoleContext
): RegistrationHandle {
  return registerConsoleFeatures(commands, kFeatures, context);
}
