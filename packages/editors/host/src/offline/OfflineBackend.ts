// Import Internal Dependencies
import type { StandaloneConnection } from "../editor/StandaloneConnection.ts";
import type { LaunchSource } from "../launch/index.ts";
import type { OfflineMode } from "../session/OfflineMode.ts";

export interface OfflineBackend extends OfflineMode {
  launchSources(
    accepts: string
  ): LaunchSource[];
  connect(): StandaloneConnection;
  close(): Promise<void>;
}
