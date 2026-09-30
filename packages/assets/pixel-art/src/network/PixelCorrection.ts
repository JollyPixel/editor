// Import Third-party Dependencies
import type {
  PixelBuffer,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireCommand } from "./types.ts";
import {
  packColors,
  packPositions,
  selectEditPixels,
  strokePositions
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

function paintedPositions(
  command: PixelWireCommand
): Vec2[] | null {
  switch (command.action) {
    case "stroke":
      return strokePositions(command.metadata);
    case "select-edit":
      return selectEditPixels(command.metadata).positions;
    default:
      return null;
  }
}

function pixelKey(
  position: Vec2
): string {
  return `${position.x},${position.y}`;
}
