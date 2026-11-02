// Import Third-party Dependencies
import {
  binaryAssetKind,
  binaryCommands,
  InvalidAssetFileError,
  type AssetKindHandler,
  type AssetKindPackage,
  type BinaryAssetState
} from "@jolly-pixel/asset-server";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  SOUND_ASSET,
  SOUND_COMMAND,
  SOUND_CONTENT_TYPE,
  SOUND_EXTENSION,
  SOUND_KIND,
  SOUND_SOURCE_EXTENSIONS
} from "./sound.ts";
import { oggContentFromAudio } from "../conversion/oggFromAudio.ts";

// CONSTANTS
const kOggCapturePattern = new TextEncoder().encode("OggS");

export function soundAssetKind(): AssetKindHandler<BinaryAssetState, never> {
  return {
    ...binaryAssetKind,
    kind: SOUND_KIND,
    extensions: {
      [SOUND_EXTENSION]: SOUND_CONTENT_TYPE
    },
    conversions: Object.fromEntries(
      SOUND_SOURCE_EXTENSIONS.map((extension) => [
        extension,
        oggContentFromAudio
      ])
    ),

    load(
      state: BinaryAssetState,
      content: Uint8Array
    ): void {
      if (content.byteLength > 0 && !isOggFile(content)) {
        throw new InvalidAssetFileError(
          SOUND_KIND,
          "content is not an Ogg file"
        );
      }

      state.bytes = content;
    },

    commands: binaryCommands(SOUND_COMMAND)
  };
}

function isOggFile(
  content: Uint8Array
): boolean {
  return kOggCapturePattern.every((byte, index) => content[index] === byte);
}

export const ASSET_KINDS: AssetKindPackage = {
  descriptors: [SOUND_ASSET],
  optionsSchema: z.strictObject({}),
  handlers: () => [soundAssetKind()]
};
