// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import { Fill } from "../tools/Fill.ts";
import { PixelWorld } from "./PixelWorld.ts";
import type {
  PixelNetworkCommand
} from "./types.ts";

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
          new Uint8ClampedArray(
            toUint8Array(cmd.metadata.pixels)
          ),
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
        new Uint8ClampedArray(
          toUint8Array(cmd.metadata.pixels)
        ),
        cmd.metadata.size
      );
      break;
    }

    case "global-fill": {
      const buffer = world.getBuffer(cmd.bufferId);
      if (!buffer) {
        break;
      }

      const positions = Fill.matchAll(
        buffer,
        cmd.metadata.fromColor
      );
      buffer.drawPixels(positions, cmd.metadata.toColor);
      buffer.copyToMaster();
      break;
    }

    case "uv-region-created": {
      const buffer = world.getBuffer(cmd.bufferId);
      buffer?.uvRegions.set(cmd.metadata.region);
      break;
    }

    case "uv-region-deleted": {
      const buffer = world.getBuffer(cmd.bufferId);
      buffer?.uvRegions.remove(cmd.metadata.id);
      break;
    }

    case "uv-region-moved": {
      const buffer = world.getBuffer(cmd.bufferId);
      if (!buffer) {
        break;
      }

      const existing = buffer.uvRegions.get(cmd.metadata.id);
      if (existing) {
        buffer.uvRegions.set({
          ...existing,
          rect: cmd.metadata.rect
        });
      }
      break;
    }
  }
}
