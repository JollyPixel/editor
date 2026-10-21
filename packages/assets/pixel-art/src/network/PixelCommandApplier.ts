// Import Third-party Dependencies
import {
  toPixelDocumentCommand,
  type PixelDocumentState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  PixelWireCommand
} from "./types.ts";
import { unpackPixelCommand } from "./PixelWireCodec.ts";

export function applyPixelCommand(
  state: PixelDocumentState,
  command: PixelWireCommand
): void {
  state.apply(
    toPixelDocumentCommand(unpackPixelCommand(command))
  );
}
