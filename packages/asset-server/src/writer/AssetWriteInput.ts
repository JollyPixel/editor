// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { PathConflictPolicy } from "./AssetPathAllocator.ts";

export interface AssetPayload {
  data: Uint8Array;
  /**
   * Assets `data` references.
   * @default computed by the kind handler from `data`
   */
  dependencies?: readonly AssetReferenceData[];
}

export interface WriteOptions {
  actor: EventStore.Actor;
  alreadyProjected?: boolean;
  expectedVersion?: number;
}

interface PayloadWriteOptions extends WriteOptions, AssetPayload {}

export interface CreateAssetInput extends Omit<PayloadWriteOptions, "data"> {
  path: string;
  kind?: string;
  /**
   * @default the serialized `create(assetId)` state of the kind, linked to
   * a same-named asset of each of its companion kinds
   */
  data?: Uint8Array;
  /**
   * @default the id the identity sidecar records for a vacant path, else a
   * random UUID
   */
  assetId?: string;
  onPathConflict?: PathConflictPolicy;
}

export interface UpdateAssetInput extends PayloadWriteOptions {
  assetId: string;
}

export interface RenameAssetInput extends WriteOptions {
  assetId: string;
  to: string;
}

export interface DeleteAssetInput extends WriteOptions {
  assetId: string;
}
