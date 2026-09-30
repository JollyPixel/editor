// Import Third-party Dependencies
import type { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireCommand } from "./types.ts";
import {
  paintedPositions,
  pixelKey
} from "./PixelCommandKeys.ts";
import {
  packColors,
  packPositions
} from "./PixelWireCodec.ts";

export function correctPixelCommand(
  buffer: PixelBuffer,
  command: PixelWireCommand,
  admitted: PixelWireCommand | null
): PixelWireCommand | null {
  const painted = paintedPositions(command);
  if (painted === null) {
    return null;
  }

  const kept = new Set(
    (admitted === null ? [] : paintedPositions(admitted) ?? []).map(pixelKey)
  );
  const rejected = painted.filter(
    (position) => !kept.has(pixelKey(position))
  );

  return {
    clientId: command.clientId,
    seq: command.seq,
    timestamp: command.timestamp,
    action: "select-edit",
    metadata: {
      xy: packPositions(rejected),
      rgba: packColors(buffer.samplePixels(rejected))
    }
  };
}
