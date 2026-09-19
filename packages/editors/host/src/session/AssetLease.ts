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
  TCommand = any,
  TMessage = any
> {
  readonly kind: string;
  createModel(
    room: Room<TCommand, TMessage>
  ): SyncedModel<TModel>;
}

export interface AssetRoomLease<
  TCommand = any,
  TMessage = any
> {
  readonly record: AssetRecordData;
  readonly room: Room<TCommand, TMessage>;
  release(): void;
}

export interface AssetLease<
  TModel,
  TCommand = any,
  TMessage = any
> extends AssetRoomLease<TCommand, TMessage> {
  readonly model: TModel;
  readonly ready: Promise<void>;
}
