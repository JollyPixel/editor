// Import Third-party Dependencies
import type { NetworkSyncMessage } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetLiveProtocol } from "../model/kinds/AssetLiveProtocol.ts";

type SnapshotMessage = Readonly<
  Extract<NetworkSyncMessage<unknown, unknown>, { type: "snapshot"; }>
>;

export interface CachedSnapshot {
  readonly version?: number;
  readonly message: SnapshotMessage;
  readonly compress: boolean;
}

export class SnapshotCache {
  #protocol: Pick<AssetLiveProtocol, "snapshot" | "encodeSnapshot">;
  #compressPlain: boolean;
  #version: () => number | undefined;
  #plain: CachedSnapshot | null = null;
  #encoded: CachedSnapshot | null = null;

  constructor(
    protocol: Pick<
      AssetLiveProtocol,
      "snapshot" | "encodeSnapshot" | "compressSnapshot"
    >,
    version: () => number | undefined
  ) {
    this.#protocol = protocol;
    this.#compressPlain = protocol.compressSnapshot === true;
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

  current(): CachedSnapshot {
    const version = this.#version();
    if (version === undefined) {
      return {
        message: snapshotMessage(this.#protocol.snapshot()),
        compress: this.#compressPlain
      };
    }
    if (this.#encoded?.version === version) {
      return this.#encoded;
    }
    if (this.#plain?.version !== version) {
      this.#plain = {
        version,
        message: snapshotMessage(this.#protocol.snapshot(), version),
        compress: this.#compressPlain
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
          message: snapshotMessage(data, version),
          compress: false
        };
      }
    }
    catch {
      this.#encoded = null;
    }
  }
}

function snapshotMessage(
  data: unknown,
  version?: number
): SnapshotMessage {
  return Object.freeze({
    type: "snapshot",
    data,
    ...(version === undefined ? {} : { version })
  });
}
