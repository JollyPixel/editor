// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { Room } from "@jolly-pixel/network/client";

export interface SyncedDocument<TDocument> {
  readonly document: TDocument;
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface AssetDocumentKind<
  TDocument,
  TCommand = unknown,
  TMessage = unknown
> {
  readonly kind: string;
  createDocument(
    room: Room<TCommand, TMessage>
  ): SyncedDocument<TDocument>;
}

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

export interface AssetDependency<TDocument = unknown> {
  readonly record: AssetRecordData;
  readonly room: Room;
  readonly document: TDocument;
  readonly ready: Promise<void>;
}
