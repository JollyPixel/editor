// Import Internal Dependencies
import type { CollaboratorPresence } from "./types.ts";

export type LockState = "held" | "denied" | "contended";

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
