// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import {
  applyColorGroups,
  groupPositionsByColor
} from "../history/utils.ts";
import { Fill } from "../tools/Fill.ts";
import type { PixelBuffer } from "../buffer/PixelBuffer.ts";
import type {
  PixelNetworkCommand
} from "./types.ts";

export function applyCommandToBuffer(
  buffer: PixelBuffer,
  cmd: PixelNetworkCommand
): void {
  switch (cmd.action) {
    case "stroke":
      buffer.drawPixels(
        cmd.metadata.positions,
        cmd.metadata.color
      );
      buffer.copyToMaster();
      break;

    case "resized":
      buffer.resize(cmd.metadata.size);
      break;

    case "texture-replaced":
      buffer.replacePixels(
        new Uint8ClampedArray(
          toUint8Array(cmd.metadata.pixels)
        ),
        cmd.metadata.size
      );
      break;

    case "global-fill": {
      const positions = Fill.matchAll(
        buffer,
        cmd.metadata.fromColor
      );
      buffer.drawPixels(positions, cmd.metadata.toColor);
      buffer.copyToMaster();
      break;
    }

    case "select-edit": {
      const groupedColors = groupPositionsByColor(
        cmd.metadata.positions,
        cmd.metadata.colors
      );
      applyColorGroups(buffer, groupedColors);
      buffer.copyToMaster();
      break;
    }

    case "uv-region-created":
    case "uv-region-state-changed":
      buffer.uvRegions.set(cmd.metadata.region);
      break;

    case "uv-region-deleted":
      buffer.uvRegions.remove(cmd.metadata.id);
      break;

    case "uv-region-moved": {
      const existing = buffer.uvRegions.get(cmd.metadata.id);
      if (existing) {
        buffer.uvRegions.set(
          existing.withRect(
            cmd.metadata.rect,
            cmd.metadata.face ?? undefined
          )
        );
      }
      break;
    }
  }
}
