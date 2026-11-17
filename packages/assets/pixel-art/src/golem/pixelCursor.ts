// Import Third-party Dependencies
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { PIXEL_CURSOR_PRESENCE_KEY } from "../network/client.ts";
import type { PixelEditCommand } from "../network/server.ts";

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
