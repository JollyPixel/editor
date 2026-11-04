// Import Third-party Dependencies
import {
  InvalidAssetFileError,
  JSON_CONTENT_TYPE,
  readOnlyCommands,
  type AssetKindHandler,
  type AssetKindPackage
} from "@jolly-pixel/asset-server";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  FONT_ASSET,
  FONT_COMMAND,
  FONT_EXTENSION,
  FONT_KIND,
  FONT_SOURCE_EXTENSIONS
} from "./font.ts";
import { typefaceContentFromFont } from "../conversion/typefaceFromFont.ts";
import { InvalidTypefaceError } from "../typeface/errors/InvalidTypefaceError.ts";
import {
  decodeTypeface,
  encodeTypeface,
  TYPEFACE_SCHEMA,
  type Typeface
} from "../typeface/typeface.ts";

// CONSTANTS
const kSnapshotSchema = z.nullable(TYPEFACE_SCHEMA);

export interface FontAssetState {
  typeface: Typeface | null;
}

export function fontAssetKind(): AssetKindHandler<FontAssetState, never> {
  return {
    kind: FONT_KIND,
    extensions: {
      [FONT_EXTENSION]: JSON_CONTENT_TYPE
    },
    conversions: Object.fromEntries(
      FONT_SOURCE_EXTENSIONS.map((extension) => [
        extension,
        async(font: Uint8Array) => {
          return {
            content: await typefaceContentFromFont(font)
          };
        }
      ])
    ),

    create(): FontAssetState {
      return {
        typeface: null
      };
    },

    load(
      state: FontAssetState,
      content: Uint8Array
    ): void {
      if (content.byteLength === 0) {
        state.typeface = null;

        return;
      }

      try {
        state.typeface = decodeTypeface(content);
      }
      catch (error) {
        if (error instanceof InvalidTypefaceError) {
          throw new InvalidAssetFileError(
            FONT_KIND,
            "content is not a typeface JSON font",
            { cause: error }
          );
        }

        throw error;
      }
    },

    clear(
      state: FontAssetState
    ): void {
      state.typeface = null;
    },

    serialize(
      state: FontAssetState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        state.typeface === null ?
          new Uint8Array() :
          encodeTypeface(state.typeface)
      );
    },

    commands: readOnlyCommands({
      eventType: FONT_COMMAND,
      snapshotSchema: kSnapshotSchema,
      snapshot: (state) => state.typeface
    })
  };
}

export const ASSET_KINDS: AssetKindPackage = {
  descriptors: [FONT_ASSET],
  optionsSchema: z.strictObject({}),
  handlers: () => [fontAssetKind()]
};
