// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type ModelManager from "../features/groups/ModelManager.ts";
import type { GroupTransformSnapshot } from "../features/groups/hooks.ts";
import { snapshotTransform } from "../features/groups/transformCodec.ts";
import type {
  ModelNetworkCommand,
  ModelServerMessage
} from "../network/types.ts";
import { peerColor } from "./identity.ts";
import { PRESENCE_KEYS } from "./presenceKeys.ts";

// CONSTANTS
const kThrottleMs = 50;
const kExpiryMs = 5000;

export interface GroupTransformLivePayload {
  uuid: string;
  transform: GroupTransformSnapshot;
}

export interface GroupTransformLiveSyncOptions {
  room: network.Room<ModelNetworkCommand, ModelServerMessage>;
  modelManager: ModelManager;
}

interface LiveStream {
  uuid: string;
  /** The group's transform right before this stream started, for reverting an abandoned drag. */
  baseline: GroupTransformSnapshot;
  timer: ReturnType<typeof setTimeout>;
}

function decodeLivePayload(
  value: unknown
): GroupTransformLivePayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const uuid = Reflect.get(value, "uuid");
  const transform = Reflect.get(value, "transform");
  if (typeof uuid !== "string" || typeof transform !== "object" || transform === null) {
    return null;
  }

  return { uuid, transform: transform as GroupTransformSnapshot };
}

export class GroupTransformLiveSync extends ActorComponent {
  #room: network.Room<ModelNetworkCommand, ModelServerMessage>;
  #modelManager: ModelManager;
  #streams = new Map<string, LiveStream>();
  #lastSentAt = 0;

  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    if (!(PRESENCE_KEYS.transformLive in event.patch)) {
      return;
    }

    this.#applyLiveTransform(event.clientId, event.patch[PRESENCE_KEYS.transformLive]);
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#endStream(event.clientId, { revert: true });
  };

  constructor(
    actor: Actor,
    options: GroupTransformLiveSyncOptions
  ) {
    super({
      actor,
      typeName: "GroupTransformLiveSync"
    });

    this.#room = options.room;
    this.#modelManager = options.modelManager;

    this.#room.on("peer-presence", this.#onPeerPresence);
    this.#room.on("peer-left", this.#onPeerLeft);
  }

  publish(
    uuid: string,
    transform: GroupTransformSnapshot
  ): void {
    const now = Date.now();
    if (now - this.#lastSentAt < kThrottleMs) {
      return;
    }
    this.#lastSentAt = now;

    this.#room.updatePresence({
      [PRESENCE_KEYS.transformLive]: { uuid, transform }
    });
  }

  clear(): void {
    this.#lastSentAt = 0;
    this.#room.updatePresence({ [PRESENCE_KEYS.transformLive]: null });
  }

  override destroy(): void {
    this.#room.off("peer-presence", this.#onPeerPresence);
    this.#room.off("peer-left", this.#onPeerLeft);

    for (const clientId of [...this.#streams.keys()]) {
      this.#endStream(clientId, { revert: false });
    }

    super.destroy();
  }

  #applyLiveTransform(
    clientId: string,
    value: unknown
  ): void {
    const payload = decodeLivePayload(value);
    if (payload === null) {
      this.#endStream(clientId, { revert: false });

      return;
    }

    const localGroup = this.#modelManager.getGroupByUUID(payload.uuid);
    if (!localGroup) {
      return;
    }

    let stream = this.#streams.get(clientId);
    if (stream && stream.uuid !== payload.uuid) {
      this.#endStream(clientId, { revert: true });
      stream = undefined;
    }

    if (stream) {
      clearTimeout(stream.timer);
    }
    else {
      stream = {
        uuid: payload.uuid,
        baseline: snapshotTransform(localGroup),
        timer: setTimeout(() => this.#endStream(clientId, { revert: true }), kExpiryMs)
      };
      this.#streams.set(clientId, stream);
      localGroup.emphasize(peerColor(clientId, this.#room.peers.get(clientId)?.profile));
    }

    this.#modelManager.applyRemoteCommand({
      action: "group-transformed",
      uuid: payload.uuid,
      transform: payload.transform
    });

    stream.timer = setTimeout(() => this.#endStream(clientId, { revert: true }), kExpiryMs);
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

    const localGroup = this.#modelManager.getGroupByUUID(stream.uuid);
    localGroup?.clearEmphasis();

    if (options.revert && localGroup) {
      this.#modelManager.applyRemoteCommand({
        action: "group-transformed",
        uuid: stream.uuid,
        transform: stream.baseline
      });
    }
  }
}
