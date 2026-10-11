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
