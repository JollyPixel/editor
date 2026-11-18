// Import Third-party Dependencies
import {
  arbitrated,
  contentRefSchema,
  InvalidAssetFileError,
  NO_OPTIONS_SCHEMA,
  PASS_THROUGH_BUILD,
  type AssetKindHandler,
  type AssetKindPackage
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
import {
  changedSettings,
  SoundState
} from "../model/SoundState.ts";
import {
  soundCommandProtocol,
  soundSnapshotSchema
} from "../network/SoundCommand.schema.ts";
import type { SoundNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kOggCapturePattern = new TextEncoder().encode("OggS");
const kRefAboveBytes = 256 * 1024;
const kSnapshotSchema = z.union([
  soundSnapshotSchema,
  contentRefSchema
]);

export function soundAssetKind(): AssetKindHandler<SoundState, SoundNetworkCommand> {
  return {
    kind: SOUND_KIND,
    build: PASS_THROUGH_BUILD,
    extensions: {
      [SOUND_EXTENSION]: SOUND_CONTENT_TYPE
    },
    conversions: Object.fromEntries(
      SOUND_SOURCE_EXTENSIONS.map((extension) => [
        extension,
        async(audio: Uint8Array) => {
          return {
            content: await oggContentFromAudio(audio)
          };
        }
      ])
    ),

    create(): SoundState {
      return new SoundState();
    },

    load(
      state: SoundState,
      content: Uint8Array
    ): void {
      if (content.byteLength > 0 && !isOggFile(content)) {
        throw new InvalidAssetFileError(
          SOUND_KIND,
          "content is not an Ogg file"
        );
      }

      state.load(content);
    },

    clear(
      state: SoundState
    ): void {
      state.clear();
    },

    serialize(
      state: SoundState
    ): Promise<Uint8Array> {
      return Promise.resolve(state.bytes);
    },

    commands: {
      eventType: SOUND_COMMAND,
      protocol: soundCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state, contentRef }) {
        return {
          snapshotSchema: kSnapshotSchema,
          snapshot: () => state.bytes,
          encodeSnapshot: () => (
            contentRef === undefined || state.bytes.byteLength <= kRefAboveBytes ?
              Promise.resolve(null) :
              contentRef(state.bytes)
          ),
          ...arbitrated(state, {
            accepts: () => state.editable,
            writes: (command) => {
              return {
                keys: changedSettings(command.set)
              };
            }
          })
        };
      }
    }
  };
}

function isOggFile(
  content: Uint8Array
): boolean {
  return kOggCapturePattern.every((byte, index) => content[index] === byte);
}

export const ASSET_KINDS: AssetKindPackage = {
  descriptors: [SOUND_ASSET],
  optionsSchema: NO_OPTIONS_SCHEMA,
  handlers: () => [soundAssetKind()]
};
