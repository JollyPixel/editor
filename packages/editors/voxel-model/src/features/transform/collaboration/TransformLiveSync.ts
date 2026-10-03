// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange
} from "@jolly-pixel/network/client";
import type {
  BlockTransformJSON,
  VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/client";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import { parseBlockTransformJSON } from "./blockTransformCodec.ts";
import type { ModelBlocks } from "../../../scene/index.ts";
import { PRESENCE_KEYS } from "../../../collaboration/presenceKeys.ts";
import { LatestFrameThrottle } from "../../../collaboration/LatestFrameThrottle.ts";

// CONSTANTS
const kThrottleMs = 50;
const kExpiryMs = 5000;
const kEmphasisOwnerPrefix = "transform-live:";

export interface TransformLivePayload {
  uuid: string;
  transform: BlockTransformJSON;
}

export interface TransformLiveSyncOptions {
  room: VoxelModelRoom;
  blocks: ModelBlocks;
  requestFrame?: () => void;
}

interface LiveStream {
  uuid: string;
  baseline: BlockTransformJSON;
  timer?: ReturnType<typeof setTimeout>;
}

export class TransformLiveSync {
  #room: VoxelModelRoom;
  #blocks: ModelBlocks;
  #requestFrame: () => void;
  #channel: PresenceChannel<TransformLivePayload | null>;
  #streams = new Map<string, LiveStream>();
  #throttle: LatestFrameThrottle<TransformLivePayload>;
  #unsubscribe: () => void;

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
    this.#requestFrame = options.requestFrame ?? (() => undefined);
    this.#channel = new PresenceChannel<TransformLivePayload | null>(options.room, {
      key: PRESENCE_KEYS.transformLive,
      decode: decodeLivePayload,
      equals: () => false
    });
    this.#throttle = new LatestFrameThrottle(
      kThrottleMs,
      (payload) => this.#channel.publish(payload)
    );
    this.#unsubscribe = this.#channel.subscribe("change", this.#onPeerChange);
  }

  publish(
    uuid: string,
    transform: BlockTransformJSON
  ): void {
    this.#throttle.push({ uuid, transform });
  }

  clear(): void {
    this.#throttle.cancel();
    this.#channel.publish(null);
  }

  dispose(): void {
    this.#throttle.cancel();
    this.#unsubscribe();
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
    this.#requestFrame();
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
    this.#requestFrame();
  }
}

function decodeLivePayload(
  value: unknown
): TransformLivePayload | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const uuid: unknown = Reflect.get(value, "uuid");
  const transform = parseBlockTransformJSON(
    Reflect.get(value, "transform")
  );
  if (typeof uuid !== "string" || transform === undefined) {
    return undefined;
  }

  return {
    uuid,
    transform
  };
}
