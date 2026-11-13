// Import Third-party Dependencies
import type { LocalEdits } from "@jolly-pixel/history";
import type * as z from "zod/mini";

// Import Internal Dependencies
import type { PendingChanges } from "./CommandSync.ts";
import type { MessageProtocol } from "../../protocol/message/MessageProtocol.ts";

export interface DocumentSync extends PendingChanges {
  readonly ready: boolean;

  whenReady(): Promise<void>;
  destroy(): void;
}

export abstract class SyncedDocument<TDocument> {
  abstract readonly document: TDocument;
  readonly ready: Promise<void>;

  #sync: DocumentSync;

  get loaded(): boolean {
    return this.#sync.ready;
  }

  get pendingChanges(): PendingChanges {
    return this.#sync;
  }

  constructor(
    sync: DocumentSync
  ) {
    this.#sync = sync;
    this.ready = sync.whenReady();
  }

  dispose(): void {
    this.#sync.destroy();
  }
}

export interface DocumentKind<
  TKind extends string,
  TRoom,
  TSynced extends SyncedDocument<unknown>
> {
  readonly kind: TKind;

  syncDocument(
    room: TRoom
  ): TSynced;
}

export interface EditableDocumentKind<
  TKind extends string,
  TRoom,
  TSynced extends SyncedDocument<unknown>,
  TCommand
> extends DocumentKind<TKind, TRoom, TSynced> {
  readonly commandSchema: z.ZodMiniType<TCommand>;
  readonly commandProtocol: MessageProtocol;

  localEdits(
    synced: TSynced
  ): LocalEdits<TCommand>;
}
