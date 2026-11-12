// Import Third-party Dependencies
import type { EditableDocumentKind } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { PIXEL_ART_KIND } from "../../asset/pixelArt.ts";
import { pixelEdits } from "../../history/PixelEdits.ts";
import {
  pixelCommandProtocol,
  pixelEditCommandSchema,
  type PixelEditCommand
} from "../protocol/PixelCommand.schema.ts";
import type { PixelArtRoom } from "../protocol/types.ts";
import {
  pixelArtDocumentKind,
  type SyncedPixelDocument,
  type SyncedPixelDocumentOptions
} from "./SyncedPixelDocument.ts";

export type PixelArtEditableKind = EditableDocumentKind<
  typeof PIXEL_ART_KIND,
  PixelArtRoom,
  SyncedPixelDocument,
  PixelEditCommand
>;

export function pixelArtEditableKind(
  options: SyncedPixelDocumentOptions = {}
): PixelArtEditableKind {
  return {
    ...pixelArtDocumentKind(options),
    commandSchema: pixelEditCommandSchema,
    commandProtocol: pixelCommandProtocol,
    localEdits: (synced) => pixelEdits(synced.document)
  };
}
