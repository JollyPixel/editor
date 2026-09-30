// Import Third-party Dependencies
import type { CommandReconciler } from "@jolly-pixel/network/client";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireCommand } from "./types.ts";
import {
  narrowPixelCommand,
  pixelCommandKeys
} from "./PixelCommandKeys.ts";
import { unpackPixelCommand } from "./PixelWireCodec.ts";

// CONSTANTS
const kBufferWideActions = new Set<string>([
  "global-fill",
  "resized",
  "texture-replaced"
]);

export type PixelReplayTarget = Pick<PixelDocument, "applyRemoteCommand">;

export function revertsInPlace(
  command: PixelWireCommand
): boolean {
  return !kBufferWideActions.has(command.action);
}

export function replayPixelCommand(
  target: PixelReplayTarget,
  command: PixelWireCommand
): boolean {
  target.applyRemoteCommand(unpackPixelCommand(command));

  return true;
}

export function createPixelReconciler(
  target: PixelReplayTarget
): CommandReconciler<PixelWireCommand> {
  return {
    keys: pixelCommandKeys,
    narrow: narrowPixelCommand,
    revert: (pending) => pending.every(revertsInPlace),
    replay: (command) => replayPixelCommand(target, command)
  };
}
