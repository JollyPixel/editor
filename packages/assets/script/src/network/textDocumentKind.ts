// Import Third-party Dependencies
import {
  SyncedDocument,
  type DocumentKind
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
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

export type TextDocumentKind<TKind extends string = string> = DocumentKind<
  TKind,
  ScriptRoom,
  SyncedScript
>;

export function textDocumentKind<TKind extends string>(
  kind: TKind
): TextDocumentKind<TKind> {
  return {
    kind,
    syncDocument: (room) => new SyncedScript(room)
  };
}
