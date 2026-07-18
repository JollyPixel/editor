// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import { Fill } from "../tools/Fill.ts";
import { PixelWorld } from "./PixelWorld.ts";
import type { PixelNetworkCommand } from "./types.ts";

/**
 * Applies a single network command to a headless PixelWorld instance.
 *
 * Used by PixelSyncServer (Node.js, no DOM) and can be used standalone
 * for testing replay logic without a renderer.
 */
export function applyCommandToWorld(
  world: PixelWorld,
  cmd: PixelNetworkCommand
): void {
  switch (cmd.action) {
    case "buffer-added": {
      if (world.hasBuffer(cmd.bufferId)) {
        break;
      }

      const buffer = world.addBuffer(cmd.bufferId, {
        size: cmd.metadata.size
      });
      if (cmd.metadata.pixels) {
        buffer.replacePixels(
          new Uint8ClampedArray(toUint8Array(cmd.metadata.pixels)),
          cmd.metadata.size
        );
      }
      break;
    }

    case "buffer-removed":
      world.removeBuffer(cmd.bufferId);
      break;

    case "stroke": {
      const buffer = world.getBuffer(cmd.bufferId);
      if (!buffer) {
        break;
      }

      buffer.drawPixels(
        cmd.metadata.positions,
        cmd.metadata.color
      );
      buffer.copyToMaster();
      break;
    }

    case "resized": {
      const buffer = world.getBuffer(cmd.bufferId);
      buffer?.resize(cmd.metadata.size);
      break;
    }

    case "texture-replaced": {
      const buffer = world.getBuffer(cmd.bufferId);
      buffer?.replacePixels(
        new Uint8ClampedArray(toUint8Array(cmd.metadata.pixels)),
        cmd.metadata.size
      );
      break;
    }

    case "global-fill": {
      const buffer = world.getBuffer(cmd.bufferId);
      if (!buffer) {
        break;
      }

      const positions = Fill.matchAll(buffer, cmd.metadata.fromColor);
      buffer.drawPixels(positions, cmd.metadata.toColor);
      buffer.copyToMaster();
      break;
    }
  }
}
