// Import Internal Dependencies
import type { PeerInvite } from "../offline/peer/PeerInvite.ts";

export interface PeerSharing {
  readonly guests: number;

  invite(): PeerInvite;
  stop(): void;
}

export interface OfflineMode {
  readonly persistent: boolean;
  readonly canReset?: boolean;
  readonly peers?: PeerSharing;

  reset(): Promise<void>;
}
