// Import Third-party Dependencies
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { OfflineMode } from "../session/OfflineMode.ts";
import type { EditorSessionClient } from "../session/SessionConnection.ts";
import type { CatalogOpener } from "../session/openCatalog.ts";

export interface StandaloneConnection {
  identity: PeerIdentity;
  client: EditorSessionClient;
  openCatalog?: CatalogOpener;
  offline?: OfflineMode;
}
