// Import Third-party Dependencies
import { PIXEL_CURSOR_PRESENCE_KEY } from "@jolly-pixel/asset.pixel-art/client";
import type { PixelEditCommand } from "@jolly-pixel/asset.pixel-art/server";
import type { PeerMetadata } from "@jolly-pixel/network/client";

export function pixelCursor(
  commands: readonly PixelEditCommand[]
): PeerMetadata | null {
  for (const command of commands.toReversed()) {
    if (command.action === "stroke") {
      const last = command.metadata.positions.at(-1);
      if (last !== undefined) {
        return {
          [PIXEL_CURSOR_PRESENCE_KEY]: {
            x: last.x,
            y: last.y
          }
        };
      }
    }
  }

  return null;
}
