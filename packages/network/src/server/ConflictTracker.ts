// Import Internal Dependencies
import type { NetworkCommandHeader } from "../types.ts";
import type { ConflictResolver } from "./ConflictResolver.ts";

/**
 * Per-key conflict bookkeeping around a `ConflictResolver`.
 * `resolve()` reads state and `record()` updates it.
 */
export class ConflictTracker<
  Header extends NetworkCommandHeader = NetworkCommandHeader
> {
  #resolver: ConflictResolver<Header>;
  #lastByKey = new Map<string, Header>();

  constructor(
    resolver: ConflictResolver<Header>
  ) {
    this.#resolver = resolver;
  }

  /**
   * Resolves `incoming` against the last recorded command at `key`.
   * `key: null` skips history and resolves against `undefined`.
   */
  resolve(
    key: string | null,
    incoming: Header
  ): "accept" | "reject" {
    const existing = key === null ? undefined : this.#lastByKey.get(key);

    return this.#resolver.resolve({ incoming, existing });
  }

  /**
   * Records `incoming` as the last accepted command at `key`.
   * No-op for `key: null`.
   */
  record(
    key: string | null,
    incoming: Header
  ): void {
    if (key !== null) {
      this.#lastByKey.set(key, incoming);
    }
  }
}
