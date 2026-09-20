// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { Room } from "@jolly-pixel/network/client";

export interface SyncedModel<TModel> {
  readonly model: TModel;
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface AssetModelKind<
  TModel,
  TCommand = unknown,
  TMessage = unknown
> {
  readonly kind: string;
  createModel(
    room: Room<TCommand, TMessage>
  ): SyncedModel<TModel>;
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
  TModel,
  TCommand = unknown,
  TMessage = unknown
> extends AssetRoomLease<TCommand, TMessage> {
  readonly model: TModel;
  readonly ready: Promise<void>;
}

export interface AssetDependency<TModel = unknown> {
  readonly record: AssetRecordData;
  readonly room: Room;
  readonly model: TModel;
  readonly ready: Promise<void>;
}
