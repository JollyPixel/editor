// Import Internal Dependencies
import type { Room } from "../Room.ts";
import {
  DocumentSyncClient,
  type SyncableDocument
} from "./DocumentSyncClient.ts";
import type {
  NetworkCommandHeader,
  NetworkServerMessage,
  NetworkServerNoticeOf
} from "../../sync/types.ts";

export interface SyncedCommandDocumentOptions<
  TDocument,
  TCommand extends NetworkCommandHeader
> {
  document: TDocument;
  keys(command: TCommand): readonly string[] | null;
}

export class SyncedCommandDocument<
  TDocument extends SyncableDocument<TCommand, TSnapshot, TImage>,
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TNotice extends NetworkServerNoticeOf<TNotice>,
  TImage
> {
  readonly document: TDocument;
  readonly ready: Promise<void>;

  #sync: DocumentSyncClient<TCommand, TSnapshot, TNotice, TImage>;

  get loaded(): boolean {
    return this.#sync.ready;
  }

  constructor(
    room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>,
    options: SyncedCommandDocumentOptions<TDocument, NoInfer<TCommand>>
  ) {
    this.document = options.document;
    this.#sync = new DocumentSyncClient(room, {
      document: options.document,
      keys: options.keys
    });
    this.ready = this.#sync.whenReady();
  }

  dispose(): void {
    this.#sync.destroy();
  }
}
