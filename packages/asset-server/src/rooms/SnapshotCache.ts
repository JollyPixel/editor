// Import Internal Dependencies
import type { AssetLiveProtocol } from "../kinds/AssetLiveProtocol.ts";

export interface RoomSnapshot {
  readonly data: unknown;
  readonly version: number | undefined;
}

interface EncodedSnapshot {
  readonly version: number;
  readonly data: unknown;
}

export class SnapshotCache {
  #protocol: Pick<AssetLiveProtocol, "snapshot" | "encodeSnapshot">;
  #version: () => number | undefined;
  #encoded: EncodedSnapshot | null = null;

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
    const encoded = this.#encoded;

    return {
      version,
      data: encoded !== null && encoded.version === version ?
        encoded.data :
        this.#protocol.snapshot()
    };
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
