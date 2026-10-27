// Import Third-party Dependencies
import { MessageProtocol } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetKindDescriptor } from "../AssetKindDescriptor.ts";
import type { AssetKindHandler } from "../AssetKindHandler.ts";
import { assetInlineContentSchema } from "../../events/AssetEvents.schema.ts";
import { encodeContent } from "../../events/inlineContent.ts";
import {
  binaryAssetKind,
  type BinaryAssetState
} from "./binary.ts";

export const TEXTURE_KIND = "texture";
export const TEXTURE_COMMAND = "texture.command";

// CONSTANTS
const kExtensions: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".ktx2": "image/ktx2"
};

export const TEXTURE_ASSET: AssetKindDescriptor = {
  kind: TEXTURE_KIND,
  label: "Texture",
  extension: ".png",
  icon: {
    svg: `
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#6fa8dc" stroke="#1f2d3d" stroke-width="1.5" />
      <path d="M3 17 L9 11 L13 15 L16 12 L21 17 V19 A2 2 0 0 1 19 21 H5 A2 2 0 0 1 3 19 Z" fill="#6fbf73" />
      <circle cx="16" cy="8" r="2" fill="#f2d16b" />
    `
  }
};

export interface TextureAssetKindOptions {
  /**
   * Globs narrowing the claimed image paths.
   */
  match?: readonly string[];
}

export function textureAssetKind(
  options: TextureAssetKindOptions = {}
): AssetKindHandler<BinaryAssetState> {
  return {
    ...binaryAssetKind,
    kind: TEXTURE_KIND,
    extensions: kExtensions,
    match: options.match,
    commands: {
      eventType: TEXTURE_COMMAND,
      protocol: MessageProtocol.EMPTY,
      apply: () => void 0,
      live: ({ state }) => {
        return {
          snapshotSchema: assetInlineContentSchema,
          snapshot: () => encodeContent(state.bytes),
          arbitrate: () => null
        };
      }
    }
  };
}
