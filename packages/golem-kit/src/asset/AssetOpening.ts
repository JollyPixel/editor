// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type { Room } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  GolemAssets,
  GolemKindName
} from "../kind/golemKind.ts";

export type CatalogReader = Pick<
  CatalogClient,
  "record" | "records" | "dependencies"
>;

export interface AssetStudio {
  readonly catalog: CatalogReader;
  /**
   * The kind packages the studio serves in `project-manifest.json`. A kind
   * parses the fields it reads.
   */
  readonly kindPackages: readonly unknown[];
  /**
   * Opens another asset through the same golem, for kinds that need one.
   */
  readonly open: <TKind extends GolemKindName>(
    assetId: string,
    kind: TKind
  ) => Promise<GolemAssets[TKind]>;
}

export interface AssetOpening {
  assetId: string;
  room: Room;
  /**
   * Aborting it fails the asset with its reason.
   */
  signal: AbortSignal;
  onClose: () => void;
  studio: AssetStudio;
}
