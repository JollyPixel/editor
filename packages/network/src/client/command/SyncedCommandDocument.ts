// Import Internal Dependencies
import type { Room } from "../Room.ts";
import type { PendingChanges } from "./CommandSync.ts";
import {
  DocumentSyncClient,
  type SyncableDocument
} from "./DocumentSyncClient.ts";
import type {
  NetworkCommandHeader,
  NetworkServerMessage,
  NetworkServerNoticeOf
} from "../../sync/types.ts";

type SyncableDocumentCommand<TDocument> = TDocument extends {
  apply(command: infer TCommand, clientId: string | null): boolean;
} ? TCommand & NetworkCommandHeader : never;

type SyncableDocumentSnapshot<TDocument> = TDocument extends {
  load(snapshot: infer TSnapshot): void;
} ? TSnapshot : never;

type SyncableDocumentImage<TDocument> = TDocument extends {
  revert(images: readonly (infer TImage)[]): void;
} ? TImage : never;

export type CommandSyncableDocument<TDocument> = SyncableDocument<
  SyncableDocumentCommand<TDocument>,
  SyncableDocumentSnapshot<TDocument>,
  SyncableDocumentImage<TDocument>
>;

export type SyncedDocumentRoom<
  TDocument,
  TNotice extends NetworkServerNoticeOf<TNotice> = never
> = Room<
  SyncableDocumentCommand<TDocument>,
  NetworkServerMessage<
    SyncableDocumentCommand<TDocument>,
    SyncableDocumentSnapshot<TDocument>,
    TNotice
  >
>;

export interface SyncedCommandDocumentOptions<
  TDocument,
  TCommand extends NetworkCommandHeader
> {
  document: TDocument;
  keys(command: TCommand): readonly string[] | null;
}

export class SyncedCommandDocument<
  TDocument extends CommandSyncableDocument<TDocument>,
  TNotice extends NetworkServerNoticeOf<TNotice> = never
> {
  readonly document: TDocument;
  readonly ready: Promise<void>;

  #sync: DocumentSyncClient<
    SyncableDocumentCommand<TDocument>,
    SyncableDocumentSnapshot<TDocument>,
    TNotice,
    SyncableDocumentImage<TDocument>
  >;

  get loaded(): boolean {
    return this.#sync.ready;
  }

  get pendingChanges(): PendingChanges {
    return this.#sync;
  }

  constructor(
    room: SyncedDocumentRoom<TDocument, TNotice>,
    options: SyncedCommandDocumentOptions<
      TDocument,
      NoInfer<SyncableDocumentCommand<TDocument>>
    >
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

export interface CommandDocumentKindOptions<
  TKind extends string,
  TDocument,
  TCommand extends NetworkCommandHeader
> {
  kind: TKind;
  createDocument(): TDocument;
  keys(command: TCommand): readonly string[] | null;
}

export interface CommandDocumentKind<
  TKind extends string,
  TDocument extends CommandSyncableDocument<TDocument>,
  TNotice extends NetworkServerNoticeOf<TNotice> = never
> {
  readonly kind: TKind;
  createDocument(
    room: SyncedDocumentRoom<TDocument, TNotice>
  ): SyncedCommandDocument<TDocument, TNotice>;
}

export function commandDocumentKind<
  TKind extends string,
  TDocument extends CommandSyncableDocument<TDocument>,
  TNotice extends NetworkServerNoticeOf<TNotice> = never
>(
  options: CommandDocumentKindOptions<
    TKind,
    TDocument,
    NoInfer<SyncableDocumentCommand<TDocument>>
  >
): CommandDocumentKind<TKind, TDocument, TNotice> {
  const { kind, createDocument, keys } = options;

  return {
    kind,
    createDocument: (room) => new SyncedCommandDocument(room, {
      document: createDocument(),
      keys
    })
  };
}
