// Import Internal Dependencies
import type { AssetLiveProtocol } from "../kinds/AssetLiveProtocol.ts";

export interface RoomSnapshot {
  readonly data: unknown;
  readonly version: number | undefined;
}

interface VersionedSnapshot extends RoomSnapshot {
  readonly version: number;
}

export class SnapshotCache {
  #protocol: Pick<AssetLiveProtocol, "snapshot" | "encodeSnapshot">;
  #version: () => number | undefined;
  #plain: VersionedSnapshot | null = null;
  #encoded: VersionedSnapshot | null = null;

  constructor(
    protocol: Pick<AssetLiveProtocol, "snapshot" | "encodeSnapshot">,
    version: () => number | undefined
  ) {
    this.#protocol = protocol;
    this.#version = version;
  }

  refresh(): Promise<void> | null {
    const version = this.#version();
    if (
      this.#protocol.encodeSnapshot === undefined ||
      version === undefined ||
      this.#encoded?.version === version
    ) {
      return null;
    }

    return this.#store(
      version,
      this.#protocol.encodeSnapshot()
    );
  }

  current(): RoomSnapshot {
    const version = this.#version();
    if (version === undefined) {
      return {
        version,
        data: this.#protocol.snapshot()
      };
    }
    if (this.#encoded?.version === version) {
      return this.#encoded;
    }
    if (this.#plain?.version !== version) {
      this.#plain = {
        version,
        data: this.#protocol.snapshot()
      };
    }

    return this.#plain;
  }

  async #store(
    version: number,
    encoding: Promise<unknown>
  ): Promise<void> {
    try {
      const data = await encoding;
      if (this.#version() === version) {
        this.#encoded = {
          version,
          data
        };
      }
    }
    catch {
      this.#encoded = null;
    }
  }
}
