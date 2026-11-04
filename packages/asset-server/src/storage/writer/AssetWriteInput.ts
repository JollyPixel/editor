// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { ConvertedAsset } from "../../model/kinds/AssetKindHandler.ts";
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

interface CreateAssetTarget extends WriteOptions {
  path: string;
  kind?: string;
  /**
   * @default the id the asset index records for a vacant path, else a
   * random UUID
   */
  assetId?: string;
  onPathConflict?: PathConflictPolicy;
}

export interface CreateAssetFromPayload
  extends CreateAssetTarget, Omit<AssetPayload, "data"> {
  /**
   * @default the serialized `create(assetId)` state of the kind, linked to
   * a same-named asset of each of its companion kinds
   */
  data?: Uint8Array;
  converted?: never;
}

export interface CreateConvertedAsset extends CreateAssetTarget {
  /**
   * Content converted from another format. Each companion is created at the
   * asset's path with its kind's extension, and its id replaces the one the
   * content uses for it.
   */
  converted: ConvertedAsset;
  data?: never;
  dependencies?: never;
  parts?: never;
}

export type CreateAssetInput = CreateAssetFromPayload | CreateConvertedAsset;

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
