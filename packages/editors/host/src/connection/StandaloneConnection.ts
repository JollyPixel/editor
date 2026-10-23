// Import Third-party Dependencies
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { RoomSource } from "../lease/AssetLeases.ts";
import type { PendingOutboxes } from "../lease/outbox/PendingOutboxes.ts";
import type { ServerConnection } from "./ConnectionStatus.ts";
import type { OfflineMode } from "./OfflineMode.ts";
import type { CatalogOpener } from "./openCatalog.ts";

export interface EditorSessionClient extends RoomSource {
  destroy(): void;
}

export interface StandaloneConnection {
  identity: PeerIdentity;
  client: EditorSessionClient;
  openCatalog?: CatalogOpener;
  offline?: OfflineMode;
  /**
   * The client's link to the asset server: the catalog wait is bounded and
   * the toolbar shows when the link drops.
   */
  server?: ServerConnection;
  /**
   * Keeps pending changes in IndexedDB across page loads.
   */
  openOutboxes?: () => Promise<PendingOutboxes | null>;
}
