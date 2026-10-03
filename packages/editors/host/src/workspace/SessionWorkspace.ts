// Import Third-party Dependencies
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { LaunchSource } from "../launch/index.ts";
import type { EditorSessionClient } from "../session/EditorSession.ts";
import type { CatalogOpener } from "../session/openCatalog.ts";

export interface StandaloneConnection {
  identity: PeerIdentity;
  client: EditorSessionClient;
  openCatalog?: CatalogOpener;
  workspace?: SessionWorkspace;
}

export interface SessionWorkspace {
  readonly persistent: boolean;
  readonly canReset?: boolean;

  reset(): Promise<void>;
}

export interface StandaloneWorkspace extends SessionWorkspace {
  launchSources(
    accepts: string
  ): LaunchSource[];
  connect(): StandaloneConnection;
  close(): Promise<void>;
}
