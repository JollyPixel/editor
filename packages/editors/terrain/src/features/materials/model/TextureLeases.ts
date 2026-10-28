// Import Internal Dependencies
import type { TextureDocument } from "./TextureDocument.ts";

export interface TextureLease {
  readonly document: Pick<TextureDocument, "bytes" | "subscribe">;
  readonly ready: Promise<void>;

  release(): void;
}

interface SharedLease {
  readonly lease: TextureLease;
  readonly users: Set<() => void>;
  readonly unsubscribe: () => void;
}

export class TextureLeases {
  #lease: (assetId: string) => TextureLease;
  #shared = new Map<string, SharedLease>();

  constructor(
    lease: (assetId: string) => TextureLease
  ) {
    this.#lease = lease;
  }

  hold(
    assetId: string,
    changed: () => void
  ): TextureLease {
    const shared = this.#shared.get(assetId) ?? this.#open(assetId);
    function user(): void {
      changed();
    }
    shared.users.add(user);
    let released = false;

    return {
      document: shared.lease.document,
      ready: shared.lease.ready,
      release: () => {
        if (released) {
          return;
        }

        released = true;
        shared.users.delete(user);
        if (shared.users.size === 0) {
          this.#shared.delete(assetId);
          shared.unsubscribe();
          shared.lease.release();
        }
      }
    };
  }

  #open(
    assetId: string
  ): SharedLease {
    const lease = this.#lease(assetId);
    const users = new Set<() => void>();
    const shared: SharedLease = {
      lease,
      users,
      unsubscribe: lease.document.subscribe("reset", () => {
        for (const user of [...users]) {
          user();
        }
      })
    };
    this.#shared.set(assetId, shared);

    return shared;
  }
}
