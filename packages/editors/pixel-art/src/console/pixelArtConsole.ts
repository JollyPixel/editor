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
import {
  uvNetConsole,
  type UvNetConsoleContext
} from "../uv/nets/uvNetConsole.ts";

// CONSTANTS
const kFeatures: readonly ConsoleFeature<PixelArtConsoleContext>[] = [
  keybindConsole,
  uvNetConsole
];

export type PixelArtConsoleContext = KeybindConsoleContext & UvNetConsoleContext;

export function pixelArtConsole(
  commands: CommandConsole,
  context: PixelArtConsoleContext
): RegistrationHandle {
  return registerConsoleFeatures(commands, kFeatures, context);
}
