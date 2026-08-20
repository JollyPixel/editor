// Import Internal Dependencies
import type { NetworkCommandHeader } from "../sync/types.ts";
import type { ConflictResolver } from "./ConflictResolver.ts";

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
   * A null key resolves without history.
   */
  resolve(
    key: string | null,
    incoming: Header
  ): "accept" | "reject" {
    const existing = key === null
      ? undefined
      : this.#lastByKey.get(key);

    return this.#resolver.resolve({
      incoming,
      existing
    });
  }

  /**
   * A null key is not recorded.
   */
  record(
    key: string | null,
    incoming: Header
  ): void {
    if (key !== null) {
      this.#lastByKey.set(
        key,
        incoming
      );
    }
  }
}
