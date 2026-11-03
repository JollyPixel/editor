// Import Third-party Dependencies
import {
  SyncedDocument,
  type DocumentKind
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { SCRIPT_KIND } from "../asset/script.ts";
import { ScriptDocument } from "../model/ScriptDocument.ts";
import { ScriptSyncClient } from "./ScriptSyncClient.ts";
import type { ScriptRoom } from "./types.ts";

export class SyncedScript extends SyncedDocument<ScriptDocument> {
  readonly document: ScriptDocument;

  constructor(
    room: ScriptRoom
  ) {
    const document = new ScriptDocument();
    super(new ScriptSyncClient(room, document));
    this.document = document;
  }
}

export type ScriptDocumentKind = DocumentKind<
  typeof SCRIPT_KIND,
  ScriptRoom,
  SyncedScript
>;

export function scriptDocumentKind(): ScriptDocumentKind {
  return {
    kind: SCRIPT_KIND,
    syncDocument: (room) => new SyncedScript(room)
  };
}
