// Import Third-party Dependencies
import type {
  EditableDocumentKind,
  SyncedDocumentRoom
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { ENVIRONMENT_KIND } from "../asset/environment.ts";
import type { EnvironmentDocument } from "../model/EnvironmentDocument.ts";
import {
  environmentCommandProtocol,
  environmentCommandSchema
} from "./EnvironmentCommand.schema.ts";
import {
  environmentDocumentKind,
  type SyncedEnvironmentDocument
} from "./environmentDocumentKind.ts";
import type { EnvironmentCommand } from "./types.ts";

export type EnvironmentEditableKind = EditableDocumentKind<
  typeof ENVIRONMENT_KIND,
  SyncedDocumentRoom<EnvironmentDocument, AssetRoomNotice>,
  SyncedEnvironmentDocument,
  EnvironmentCommand
>;

export function environmentEditableKind(): EnvironmentEditableKind {
  return {
    ...environmentDocumentKind(),
    commandSchema: environmentCommandSchema,
    commandProtocol: environmentCommandProtocol,
    localEdits: (synced) => synced.document
  };
}
