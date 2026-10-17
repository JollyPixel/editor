// Import Third-party Dependencies
import type { NetworkSyncMessage } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetLiveProtocol } from "../kinds/AssetLiveProtocol.ts";

type SnapshotMessage = Readonly<
  Extract<NetworkSyncMessage<unknown, unknown>, { type: "snapshot"; }>
>;

interface VersionedMessage {
  readonly version: number;
  readonly message: SnapshotMessage;
}

export class SnapshotCache {
  #protocol: Pick<AssetLiveProtocol, "snapshot" | "encodeSnapshot">;
  #version: () => number | undefined;
  #plain: VersionedMessage | null = null;
  #encoded: VersionedMessage | null = null;

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

  current(): SnapshotMessage {
    const version = this.#version();
    if (version === undefined) {
      return snapshotMessage(this.#protocol.snapshot());
    }
    if (this.#encoded?.version === version) {
      return this.#encoded.message;
    }
    if (this.#plain?.version !== version) {
      this.#plain = {
        version,
        message: snapshotMessage(this.#protocol.snapshot(), version)
      };
    }

    return this.#plain.message;
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
          message: snapshotMessage(data, version)
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
