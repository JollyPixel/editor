// Import Third-party Dependencies
import {
  commandDocumentKind,
  type CommandDocumentKind,
  type SyncedCommandDocument
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { SCENE_KIND } from "../asset/scene.ts";
import { SceneDocument } from "../model/SceneDocument.ts";
import { sceneWriteKeys } from "../model/SceneCommandKeys.ts";

export type SyncedSceneDocument = SyncedCommandDocument<
  SceneDocument,
  AssetRoomNotice
>;

export type SceneDocumentKind = CommandDocumentKind<
  typeof SCENE_KIND,
  SceneDocument,
  AssetRoomNotice
>;

export function sceneDocumentKind(): SceneDocumentKind {
  return commandDocumentKind({
    kind: SCENE_KIND,
    createDocument: () => new SceneDocument(),
    keys: sceneWriteKeys
  });
}
