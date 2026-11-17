// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type { Room } from "@jolly-pixel/network/client";

export type CatalogReader = Pick<
  CatalogClient,
  "record" | "records" | "dependencies"
>;

export interface StudioManifest {
  /**
   * A kind parses the editor fields it reads.
   */
  readonly editors: readonly unknown[];
}

export interface GolemAssets {}

export type GolemKind = keyof GolemAssets;

export interface AssetOpening {
  assetId: string;
  room: Room;
  catalog: CatalogReader;
  /**
   * What the studio serves in `project-manifest.json`.
   */
  manifest: StudioManifest;
  /**
   * Aborting it fails the asset with its reason.
   */
  signal: AbortSignal;
  onClose: () => void;
  /**
   * Opens another asset through the same golem, for kinds that need one.
   */
  open: <TKind extends GolemKind>(
    assetId: string,
    kind: TKind
  ) => Promise<GolemAssets[TKind]>;
}
