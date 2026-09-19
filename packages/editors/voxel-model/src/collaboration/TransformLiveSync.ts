// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange
} from "@jolly-pixel/network/client";
import type { GroupTransformJSON } from "@jolly-pixel/asset.voxel-model/network/client.ts";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { ModelBlocks } from "../model/index.ts";
import { PRESENCE_KEYS } from "./presenceKeys.ts";
import type { VoxelModelRoom } from "./types.ts";

// CONSTANTS
const kThrottleMs = 50;
const kExpiryMs = 5000;
const kEmphasisOwnerPrefix = "transform-live:";

export interface TransformLivePayload {
  uuid: string;
  transform: GroupTransformJSON;
}

export interface TransformLiveSyncOptions {
  room: VoxelModelRoom;
  blocks: ModelBlocks;
}

interface LiveStream {
  uuid: string;
  baseline: GroupTransformJSON;
  timer?: ReturnType<typeof setTimeout>;
}

export class TransformLiveSync {
  #room: VoxelModelRoom;
  #blocks: ModelBlocks;
  #channel: PresenceChannel<TransformLivePayload | null>;
  #streams = new Map<string, LiveStream>();
  #lastSentAt = 0;

  #onPeerChange = (
    change: PresenceChange<TransformLivePayload | null>
  ): void => {
    const { clientId, value } = change;
    if (value) {
      this.#applyLiveTransform(clientId, value);
    }
    else {
      this.#endStream(clientId, { revert: !this.#room.peers.has(clientId) });
    }
  };

  constructor(
    options: TransformLiveSyncOptions
  ) {
    this.#room = options.room;
    this.#blocks = options.blocks;
    this.#channel = new PresenceChannel<TransformLivePayload | null>(options.room, {
      key: PRESENCE_KEYS.transformLive,
      decode: decodeLivePayload,
      equals: () => false
    });
    this.#channel.on("change", this.#onPeerChange);
  }

  publish(
    uuid: string,
    transform: GroupTransformJSON
  ): void {
    const now = Date.now();
    if (now - this.#lastSentAt < kThrottleMs) {
      return;
    }
    this.#lastSentAt = now;

    this.#channel.publish({ uuid, transform });
  }

  clear(): void {
    this.#lastSentAt = 0;
    this.#channel.publish(null);
  }

  dispose(): void {
    this.#channel.off("change", this.#onPeerChange);
    for (const clientId of [...this.#streams.keys()]) {
      this.#endStream(clientId, { revert: false });
    }
    this.#channel.destroy();
  }

  #applyLiveTransform(
    clientId: string,
    payload: TransformLivePayload
  ): void {
    const block = this.#blocks.get(payload.uuid);
    if (!block) {
      return;
    }

    let stream = this.#streams.get(clientId);
    if (stream?.uuid !== payload.uuid) {
      this.#endStream(clientId, { revert: true });
      stream = {
        uuid: payload.uuid,
        baseline: block.transform
      };
      this.#streams.set(clientId, stream);
      block.emphasize(
        peerProfileColor(clientId, this.#room.peers.get(clientId)?.profile),
        `${kEmphasisOwnerPrefix}${clientId}`
      );
    }

    clearTimeout(stream.timer);
    this.#blocks.applyTransform(payload.uuid, payload.transform);
    stream.timer = setTimeout(
      () => this.#endStream(clientId, { revert: true }),
      kExpiryMs
    );
  }

  #endStream(
    clientId: string,
    options: { revert: boolean; }
  ): void {
    const stream = this.#streams.get(clientId);
    if (!stream) {
      return;
    }

    clearTimeout(stream.timer);
    this.#streams.delete(clientId);

    const block = this.#blocks.get(stream.uuid);
    block?.clearEmphasis(`${kEmphasisOwnerPrefix}${clientId}`);
    if (options.revert) {
      this.#blocks.applyTransform(stream.uuid, stream.baseline);
    }
  }
}

function decodeLivePayload(
  value: unknown
): TransformLivePayload | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const uuid = Reflect.get(value, "uuid");
  const transform = Reflect.get(value, "transform");
  if (typeof uuid !== "string" || typeof transform !== "object" || transform === null) {
    return undefined;
  }

  return {
    uuid,
    transform: transform as GroupTransformJSON
  };
}
