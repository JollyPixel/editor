// Import Internal Dependencies
import type { AssetKindDescriptor } from "../AssetKindDescriptor.ts";
import type {
  AssetKindHandler,
  AssetPreview
} from "../AssetKindHandler.ts";
import {
  binaryAssetKind,
  binaryCommands,
  type BinaryAssetState
} from "./binary.ts";

export const TEXTURE_KIND = "texture";
export const TEXTURE_COMMAND = "texture.command";
export const TEXTURE_EXTENSIONS: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".ktx2": "image/ktx2"
};

// CONSTANTS
const kMaxPreviewBytes = 2 * 1024 * 1024;
const kSignatures: readonly ImageSignature[] = [
  {
    type: "image/png",
    prefix: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  },
  {
    type: "image/jpeg",
    prefix: [0xFF, 0xD8, 0xFF]
  },
  {
    type: "image/gif",
    prefix: [0x47, 0x49, 0x46, 0x38]
  },
  {
    type: "image/webp",
    prefix: [
      0x52, 0x49, 0x46, 0x46,
      null, null, null, null,
      0x57, 0x45, 0x42, 0x50
    ]
  },
  {
    type: "image/bmp",
    prefix: [0x42, 0x4D]
  }
];

interface ImageSignature {
  readonly type: string;
  readonly prefix: readonly (number | null)[];
}

export const TEXTURE_ASSET: AssetKindDescriptor = {
  kind: TEXTURE_KIND,
  label: "Texture",
  extension: ".png",
  creatable: false,
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
    extensions: TEXTURE_EXTENSIONS,
    match: options.match,
    commands: binaryCommands(TEXTURE_COMMAND),

    async preview(
      state: BinaryAssetState
    ): Promise<AssetPreview | null> {
      return texturePreview(state.bytes);
    }
  };
}

function texturePreview(
  bytes: Uint8Array
): AssetPreview | null {
  if (bytes.byteLength > kMaxPreviewBytes) {
    return null;
  }

  const signature = kSignatures.find(
    ({ prefix }) => prefix.every(
      (byte, index) => byte === null || bytes[index] === byte
    )
  );

  return signature === undefined ?
    null :
    {
      type: signature.type,
      bytes
    };
}
