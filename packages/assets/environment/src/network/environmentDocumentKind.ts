// Import Third-party Dependencies
import {
  commandDocumentKind,
  type CommandDocumentKind,
  type SyncedCommandDocument
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { ENVIRONMENT_KIND } from "../asset/environment.ts";
import { EnvironmentDocument } from "../model/EnvironmentDocument.ts";
import { environmentWriteKeys } from "../model/EnvironmentState.ts";

export type SyncedEnvironmentDocument = SyncedCommandDocument<
  EnvironmentDocument,
  AssetRoomNotice
>;

export type EnvironmentDocumentKind = CommandDocumentKind<
  typeof ENVIRONMENT_KIND,
  EnvironmentDocument,
  AssetRoomNotice
>;

export function environmentDocumentKind(): EnvironmentDocumentKind {
  return commandDocumentKind({
    kind: ENVIRONMENT_KIND,
    createDocument: () => new EnvironmentDocument(),
    keys: environmentWriteKeys
  });
}
