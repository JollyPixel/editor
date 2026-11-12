// Import Third-party Dependencies
import type { ChangeReceipts } from "@jolly-pixel/history";
import {
  SyncedDocument,
  type DocumentKind
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { ScriptDocument } from "../model/ScriptDocument.ts";
import { ScriptSyncClient } from "./ScriptSyncClient.ts";
import type {
  ScriptCommand,
  ScriptRoom,
  ScriptStep
} from "./types.ts";

export class SyncedScript extends SyncedDocument<ScriptDocument> {
  readonly document: ScriptDocument;

  #sync: ScriptSyncClient;

  constructor(
    room: ScriptRoom
  ) {
    const document = new ScriptDocument();
    const sync = new ScriptSyncClient(room, document);
    super(sync);
    this.document = document;
    this.#sync = sync;
  }

  get receipts(): ChangeReceipts<ScriptStep> {
    return this.#sync.receipts;
  }

  applyStep(
    command: ScriptCommand
  ): ScriptStep | null {
    return this.#sync.applyStep(command);
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
