// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type {
  DocumentKind,
  Room,
  SyncedDocument
} from "@jolly-pixel/network/client";

export type AssetDocumentKind<
  TDocument,
  TCommand = unknown,
  TMessage = unknown
> = DocumentKind<
  string,
  Room<TCommand, TMessage>,
  SyncedDocument<TDocument>
>;

export interface AssetRoomLease<
  TCommand = unknown,
  TMessage = unknown
> {
  readonly record: AssetRecordData;
  readonly room: Room<TCommand, TMessage>;

  release(): void;
}

export interface AssetLease<
  TDocument,
  TCommand = unknown,
  TMessage = unknown
> extends AssetRoomLease<TCommand, TMessage> {
  readonly document: TDocument;
  readonly ready: Promise<void>;
}

export interface AssetDependency<
  TDocument = unknown
> {
  readonly record: AssetRecordData;
  readonly room: Room;
  readonly document: TDocument;
  readonly ready: Promise<void>;
}
