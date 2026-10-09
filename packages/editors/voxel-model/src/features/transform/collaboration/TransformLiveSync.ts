// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange
} from "@jolly-pixel/network/client";
import {
  BlockTransform,
  type BlockTransformJSON,
  type VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/client";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { ModelBlocks } from "../../../scene/index.ts";
import { PRESENCE_KEYS } from "../../../collaboration/presenceKeys.ts";
import { LatestFrameThrottle } from "../../../collaboration/LatestFrameThrottle.ts";
import { combineReleases } from "../../../shared/combineReleases.ts";

// CONSTANTS
const kThrottleMs = 50;
const kExpiryMs = 5000;
const kEmphasisOwnerPrefix = "transform-live:";

export interface TransformLivePayload {
  uuid: string;
  transform: BlockTransformJSON;
  /**
   * The posed view being edited, `null` for a rest pose edit.
   */
  view: string | null;
}

export interface LiveView {
  /**
   * Names the pose the viewport shows, `null` for the rest pose.
   */
  key(): string | null;
  /**
   * Where `uuid` stands in that pose without any live edit.
   */
  shownTransform(uuid: string): BlockTransformJSON | undefined;
  subscribe(listener: () => void): () => void;
}

export interface TransformLiveSyncOptions {
  room: VoxelModelRoom;
  blocks: ModelBlocks;
  view: LiveView;
  requestFrame?: () => void;
}

interface LiveStream {
  uuid: string;
  view: string | null;
  timer?: ReturnType<typeof setTimeout>;
}

export class TransformLiveSync {
  #room: VoxelModelRoom;
  #blocks: ModelBlocks;
  #view: LiveView;
  #requestFrame: () => void;
  #channel: PresenceChannel<TransformLivePayload | null>;
  #streams = new Map<string, LiveStream>();
  #throttle: LatestFrameThrottle<TransformLivePayload>;
  #release: () => void;

  #onPeerChange = (
    change: PresenceChange<TransformLivePayload | null>
  ): void => {
    const { clientId, value } = change;
    if (value) {
      this.#applyLiveTransform(clientId, value);
    }
    else if (this.#room.peers.has(clientId)) {
      this.#settle(clientId);
    }
    else {
      this.#drop(clientId);
    }
  };

  constructor(
    options: TransformLiveSyncOptions
  ) {
    this.#room = options.room;
    this.#blocks = options.blocks;
    this.#view = options.view;
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
    this.#release = combineReleases([
      this.#channel.subscribe("change", this.#onPeerChange),
      this.#view.subscribe(this.#onViewChange)
    ]);
  }

  publish(
    uuid: string,
    transform: BlockTransformJSON
  ): void {
    this.#throttle.push({
      uuid,
      transform,
      view: this.#view.key()
    });
  }

  clear(): void {
    this.#throttle.cancel();
    this.#channel.publish(null);
  }

  dispose(): void {
    this.#throttle.cancel();
    this.#release();
    for (const clientId of [...this.#streams.keys()]) {
      this.#stop(clientId);
    }
    this.#channel.destroy();
  }

  readonly #onViewChange = (): void => {
    const shown = this.#view.key();
    for (const [clientId, stream] of [...this.#streams]) {
      if (stream.view !== shown) {
        this.#drop(clientId);
      }
    }
  };

  #applyLiveTransform(
    clientId: string,
    payload: TransformLivePayload
  ): void {
    const { uuid, view } = payload;
    const block = this.#blocks.get(uuid);
    if (!block || view !== this.#view.key()) {
      this.#drop(clientId);

      return;
    }

    let stream = this.#streams.get(clientId);
    if (stream?.uuid !== uuid || stream.view !== view) {
      this.#drop(clientId);
      stream = {
        uuid,
        view
      };
      this.#streams.set(clientId, stream);
      block.emphasize(
        peerProfileColor(clientId, this.#room.peers.get(clientId)?.profile),
        `${kEmphasisOwnerPrefix}${clientId}`
      );
    }

    clearTimeout(stream.timer);
    this.#blocks.applyTransform(uuid, payload.transform);
    this.#requestFrame();
    stream.timer = setTimeout(
      () => this.#drop(clientId),
      kExpiryMs
    );
  }

  #settle(
    clientId: string
  ): void {
    const stream = this.#stop(clientId);
    if (stream !== undefined && !commitLandsAsStreamed(stream)) {
      this.#repose(stream.uuid);
    }
  }

  #drop(
    clientId: string
  ): void {
    const stream = this.#stop(clientId);
    if (stream !== undefined) {
      this.#repose(stream.uuid);
    }
  }

  #stop(
    clientId: string
  ): LiveStream | undefined {
    const stream = this.#streams.get(clientId);
    if (stream === undefined) {
      return undefined;
    }

    clearTimeout(stream.timer);
    this.#streams.delete(clientId);
    this.#blocks.get(stream.uuid)?.clearEmphasis(`${kEmphasisOwnerPrefix}${clientId}`);
    this.#requestFrame();

    return stream;
  }

  #repose(
    uuid: string
  ): void {
    const transform = this.#view.shownTransform(uuid);
    if (transform !== undefined) {
      this.#blocks.applyTransform(uuid, transform);
    }
  }
}

function commitLandsAsStreamed(
  stream: LiveStream
): boolean {
  return stream.view === null;
}

function decodeLivePayload(
  value: unknown
): TransformLivePayload | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const uuid: unknown = Reflect.get(value, "uuid");
  const transform = BlockTransform.parse(Reflect.get(value, "transform"));
  const view: unknown = Reflect.get(value, "view");
  if (
    typeof uuid !== "string" ||
    transform === undefined ||
    (view !== null && typeof view !== "string")
  ) {
    return undefined;
  }

  return { uuid, transform, view };
}
