// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { PathConflictPolicy } from "../../model/PathConflictPolicy.ts";

export interface AssetPayload {
  data: Uint8Array;
  /**
   * Assets `data` references.
   * @default computed by the kind handler from `data`
   */
  dependencies?: readonly AssetReferenceData[];
  /**
   * Parts written by this payload, or `null` for a part it removes. An update
   * keeps the parts it does not name. Parts `data` does not list are dropped.
   * Only kinds that declare parts take it.
   */
  parts?: ReadonlyMap<string, Uint8Array | null>;
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
   * @default the id the asset index records for a vacant path, else a
   * random UUID
   */
  assetId?: string;
  onPathConflict?: PathConflictPolicy;
}

export interface RestoredFrom {
  name: string;
  eventVersion: number;
}

export interface UpdateAssetInput extends PayloadWriteOptions {
  assetId: string;
  /**
   * The tag whose content this update brings back. Audit data only.
   */
  restoredFrom?: RestoredFrom;
}

export interface RenameAssetInput extends WriteOptions {
  assetId: string;
  to: string;
}

export interface DeleteAssetInput extends WriteOptions {
  assetId: string;
}
