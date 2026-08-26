// Import Third-party Dependencies
import { ColorPalette } from "@jolly-pixel/color";
import type * as network from "@jolly-pixel/network/client";
import type * as THREE from "three";

// Import Internal Dependencies
import {
  PeerFrustum,
  type PeerFrustumOptions
} from "../peer-frustum/PeerFrustum.ts";
import {
  decodePeerFrustumPose,
  peerFrustumPoseEqual,
  type PeerFrustumPose
} from "./PeerFrustumPose.ts";

// CONSTANTS
const kDefaultPresenceKey = "frustum";
const kDefaultThrottleMs = 50;

export interface PeerFrustumSyncOptions<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  /**
   * Object3D remote peers' frustums are added to/removed from (typically the scene).
   */
  parent: THREE.Object3D;
  /**
   * Presence field poses are published under. Change it when a room carries
   * more than one frustum stream.
   * @default "frustum"
   */
  presenceKey?: string;
  /**
   * Minimum delay between two presence updates, in milliseconds. `0` reports
   * on every `update()` where the pose moved.
   * @default 50
   */
  throttleMs?: number;
  /**
   * Extracts a display label from a peer's identity.
   * @default reads `identity.username` when it's a string
   */
  getLabel?: (
    clientId: string,
    identity: network.PeerMetadata
  ) => string | undefined;
  /**
   * Chooses the color shared by a remote peer's frustum and other presence UI.
   *
   * `clientId` is the id the server assigned to that peer, which no client can
   * compute for itself: `room.clientId` is local and never leaves the tab. Map
   * the color from a field the host stamps into `identity` when the local tab
   * must agree with its peers on its own color.
   *
   * @default a deterministic color from the built-in palette
   */
  getColor?: (
    clientId: string,
    identity: network.PeerMetadata
  ) => THREE.ColorRepresentation;
  /**
   * Shared visual options applied to every remote peer's frustum.
   * `color` and `displayName` are driven by presence/identity instead and ignored here.
   */
  frustum?: Omit<PeerFrustumOptions, "color" | "displayName">;
}

function defaultGetLabel(
  _clientId: string,
  identity: network.PeerMetadata
): string | undefined {
  return typeof identity.username === "string" ? identity.username : undefined;
}

export class PeerFrustumSync<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  #room: network.Room<ClientMessage, ServerMessage>;
  #parent: THREE.Object3D;
  #presenceKey: string;
  #throttleMs: number;
  #getLabel: (
    clientId: string,
    identity: network.PeerMetadata
  ) => string | undefined;
  #getColor: (
    clientId: string,
    identity: network.PeerMetadata
  ) => THREE.ColorRepresentation;
  #frustumOptions: Omit<PeerFrustumOptions, "color" | "displayName">;
  #palette = new ColorPalette();
  #peers = new Map<string, PeerFrustum>();
  #source: THREE.Object3D | undefined;
  #lastSent: PeerFrustumPose | undefined;
  #lastSentAt = 0;

  #onSync = (): void => {
    this.#reconcilePeers();
    this.#invalidateLastSent();
  };
  #onPeerJoined = (
    event: network.RoomPeerEvent
  ): void => {
    this.#syncPeer(event.clientId);
    this.#invalidateLastSent();
  };
  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#removePeer(event.clientId);
  };
  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    this.#applyPresencePatch(event.clientId, event.patch);
  };

  constructor(
    options: PeerFrustumSyncOptions<ClientMessage, ServerMessage>
  ) {
    this.#room = options.room;
    this.#parent = options.parent;
    this.#presenceKey = options.presenceKey ?? kDefaultPresenceKey;
    this.#throttleMs = options.throttleMs ?? kDefaultThrottleMs;
    this.#getLabel = options.getLabel ?? defaultGetLabel;
    this.#getColor = options.getColor ?? (
      (clientId) => this.#palette.forKey(clientId)
    );
    this.#frustumOptions = options.frustum ?? {};

    this.#room.on("sync", this.#onSync);
    this.#room.on("peer-joined", this.#onPeerJoined);
    this.#room.on("peer-left", this.#onPeerLeft);
    this.#room.on("peer-presence", this.#onPeerPresence);
  }

  attach(
    source: THREE.Object3D
  ): void {
    if (this.#source) {
      throw new Error("A source is already attached to this session");
    }

    this.#source = source;
    this.#reconcilePeers();
  }

  detach(): void {
    this.#source = undefined;
    this.#invalidateLastSent();
  }

  destroy(): void {
    this.detach();
    this.#room.off("sync", this.#onSync);
    this.#room.off("peer-joined", this.#onPeerJoined);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);

    for (const clientId of [...this.#peers.keys()]) {
      this.#removePeer(clientId);
    }
  }

  update(): void {
    if (!this.#source) {
      return;
    }

    const { x, y, z } = this.#source.position;
    const { x: qx, y: qy, z: qz, w: qw } = this.#source.quaternion;
    this.#reportLocal({
      position: { x, y, z },
      quaternion: { x: qx, y: qy, z: qz, w: qw }
    });
  }

  refreshColors(): void {
    for (const [clientId, frustum] of this.#peers) {
      const identity = this.#room.peers.get(clientId)?.identity ?? {};
      frustum.color = this.#getColor(clientId, identity);
    }
  }

  #reportLocal(
    pose: PeerFrustumPose
  ): void {
    if (this.#lastSent !== undefined) {
      if (peerFrustumPoseEqual(pose, this.#lastSent)) {
        return;
      }

      if (Date.now() - this.#lastSentAt < this.#throttleMs) {
        return;
      }
    }

    this.#lastSent = pose;
    this.#lastSentAt = Date.now();
    this.#room.updatePresence({
      [this.#presenceKey]: pose
    });
  }

  #invalidateLastSent(): void {
    this.#lastSent = undefined;
  }

  #reconcilePeers(): void {
    for (const [clientId, peer] of this.#room.peers) {
      if (!this.#peers.has(clientId)) {
        this.#applyPeer(clientId, peer.identity, peer.presence);
      }
    }
  }

  #syncPeer(
    clientId: string
  ): void {
    const peer = this.#room.peers.get(clientId);
    if (!peer) {
      return;
    }

    this.#applyPeer(
      clientId,
      peer.identity,
      peer.presence
    );
  }

  #applyPresencePatch(
    clientId: string,
    patch: network.PeerMetadata
  ): void {
    if (!(this.#presenceKey in patch)) {
      return;
    }

    const identity = this.#room.peers.get(clientId)?.identity ?? {};
    this.#applyPeer(
      clientId,
      identity,
      patch
    );
  }

  #applyPeer(
    clientId: string,
    identity: network.PeerMetadata,
    presence: network.PeerMetadata
  ): void {
    const pose = decodePeerFrustumPose(presence[this.#presenceKey]);

    if (pose === undefined) {
      const frustum = this.#peers.get(clientId);
      if (frustum) {
        frustum.visible = false;
      }

      return;
    }

    const frustum = this.#peers.get(clientId) ?? this.#createPeer(clientId, identity);
    frustum.visible = true;
    frustum.position.copy(pose.position);
    frustum.quaternion.copy(pose.quaternion);
  }

  #createPeer(
    clientId: string,
    identity: network.PeerMetadata
  ): PeerFrustum {
    const frustum = new PeerFrustum({
      ...this.#frustumOptions,
      color: this.#getColor(clientId, identity),
      displayName: this.#getLabel(clientId, identity)
    });
    this.#parent.add(frustum);
    this.#peers.set(clientId, frustum);

    return frustum;
  }

  #removePeer(
    clientId: string
  ): void {
    const frustum = this.#peers.get(clientId);
    if (!frustum) {
      return;
    }

    this.#parent.remove(frustum);
    frustum.dispose();
    this.#peers.delete(clientId);
  }
}
