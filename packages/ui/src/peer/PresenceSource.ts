// Import Internal Dependencies
import type { CollaboratorPresence } from "./types.ts";

/**
 * `contended` is advisory; `denied` rejects the claim.
 */
export type LockState = "held" | "denied" | "contended";

/**
 * Transport-neutral presence API whose peer map includes the local client.
 */
export interface PresenceSource {
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, CollaboratorPresence>;
  claim(
    path: string
  ): LockState;
  release(
    path: string
  ): void;
  on(
    event: "change",
    listener: () => void
  ): void;
  off(
    event: "change",
    listener: () => void
  ): void;
}

/**
 * Fallback source used when no ancestor provides collaboration.
 */
export class NullPresenceSource implements PresenceSource {
  readonly clientId = "";
  readonly peers: ReadonlyMap<string, CollaboratorPresence> = new Map();

  claim(): LockState {
    return "held";
  }

  release(): void {
    // Nothing to release.
  }

  on(): void {
    // No changes to observe.
  }

  off(): void {
    // No listeners to remove.
  }
}
