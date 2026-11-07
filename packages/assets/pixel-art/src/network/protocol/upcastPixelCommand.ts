// Import Third-party Dependencies
import { decodeBase64 } from "@jolly-pixel/utils";

export function upcastPixelCommand(
  stored: unknown
): unknown {
  if (!isLegacyTextureReplaced(stored)) {
    return stored;
  }

  const pixels = decodeBase64(stored.metadata.pixels);

  return pixels === null ?
    stored :
    {
      ...stored,
      metadata: {
        ...stored.metadata,
        pixels
      }
    };
}

function isLegacyTextureReplaced(
  stored: unknown
): stored is { action: string; metadata: { pixels: string; }; } {
  return typeof stored === "object" &&
    stored !== null &&
    "action" in stored &&
    stored.action === "texture-replaced" &&
    "metadata" in stored &&
    typeof stored.metadata === "object" &&
    stored.metadata !== null &&
    "pixels" in stored.metadata &&
    typeof stored.metadata.pixels === "string";
}
