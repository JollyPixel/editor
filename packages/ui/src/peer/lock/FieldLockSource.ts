// Import Internal Dependencies
import type { PresencePeer } from "../PresencePeer.ts";

export interface FieldLockSource {
  editors(
    path: string
  ): readonly PresencePeer[];
  claim(
    path: string
  ): void;
  release(
    path: string
  ): void;
  subscribe(
    listener: () => void
  ): () => void;
}
