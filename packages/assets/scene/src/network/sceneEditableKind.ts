// Import Third-party Dependencies
import type {
  EditableDocumentKind,
  SyncedDocumentRoom
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { SCENE_KIND } from "../asset/scene.ts";
import type { SceneDocument } from "../model/SceneDocument.ts";
import {
  sceneCommandProtocol,
  sceneCommandSchema
} from "./SceneCommand.schema.ts";
import {
  sceneDocumentKind,
  type SyncedSceneDocument
} from "./sceneDocumentKind.ts";
import type { SceneCommand } from "./types.ts";

export type SceneEditableKind = EditableDocumentKind<
  typeof SCENE_KIND,
  SyncedDocumentRoom<SceneDocument, AssetRoomNotice>,
  SyncedSceneDocument,
  SceneCommand
>;

export function sceneEditableKind(): SceneEditableKind {
  return {
    ...sceneDocumentKind(),
    commandSchema: sceneCommandSchema,
    commandProtocol: sceneCommandProtocol,
    localEdits: (synced) => synced.document
  };
}
