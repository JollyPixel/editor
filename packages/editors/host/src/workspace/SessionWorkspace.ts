// Import Internal Dependencies
import type { StandaloneConnection } from "../editor/mountStandalone.ts";
import type { LaunchSource } from "../launch/index.ts";

export interface SessionWorkspace {
  readonly persistent: boolean;
  readonly canReset?: boolean;

  reset(): Promise<void>;
}

export interface StandaloneWorkspace extends SessionWorkspace {
  launchSources(
    accepts: string
  ): LaunchSource[] | Promise<LaunchSource[]>;
  connect(): StandaloneConnection;
  close(): Promise<void>;
}
