// Import Internal Dependencies
import type {
  AssetKindHandler,
  AssetPreview
} from "../AssetKindHandler.ts";
import {
  binaryAssetKind,
  binaryCommands,
  type BinaryAssetState
} from "./binary.ts";
import {
  TEXTURE_COMMAND,
  TEXTURE_EXTENSIONS,
  TEXTURE_KIND
} from "./textureAsset.ts";

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
