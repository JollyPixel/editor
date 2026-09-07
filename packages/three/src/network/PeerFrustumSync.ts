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
const kDefaultHideWithin = 0;
const kDefaultFadeWithin = 0;

export interface PeerFrustumSyncOptions<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  /**
   * Parent for remote peer frustums.
   */
  parent: THREE.Object3D;
  /**
   * Presence field for frustum poses.
   * @default "frustum"
   */
  presenceKey?: string;
  /**
   * Minimum milliseconds between pose updates. `0` sends every moved pose.
   * @default 50
   */
  throttleMs?: number;
  /**
   * Distance from the attached source below which a peer frustum is hidden,
   * in world units. Both distances default to `0`, which never fades.
   * @default 0
   */
  hideWithin?: number;
  /**
   * Distance from the attached source below which a peer frustum fades toward
   * hidden, in world units. Values at or under `hideWithin` cut without fading.
   * @default 0
   */
  fadeWithin?: number;
  /**
   * Returns a peer's display label.
   * @default reads `identity.username` when it's a string
   */
  label?: (
    clientId: string,
    identity: network.PeerMetadata
  ) => string | undefined;
  /**
   * Returns a remote peer's frustum color.
   * @default a deterministic color from the built-in palette
   */
  color?: (
    clientId: string,
    identity: network.PeerMetadata
  ) => THREE.ColorRepresentation;
  /**
   * Shared frustum options excluding `color` and `displayName`.
   */
  frustum?: Omit<PeerFrustumOptions, "color" | "displayName">;
}

function defaultLabel(
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
  #hideWithin: number;
  #fadeWithin: number;
  #label: (
    clientId: string,
    identity: network.PeerMetadata
  ) => string | undefined;
  #color: (
    clientId: string,
    identity: network.PeerMetadata
  ) => THREE.ColorRepresentation;
  #frustumOptions: Omit<PeerFrustumOptions, "color" | "displayName">;
  #palette = new ColorPalette();
  #peers = new Map<string, PeerFrustum>();
  #poses = new Map<string, PeerFrustumPose>();
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
    this.#hideWithin = options.hideWithin ?? kDefaultHideWithin;
    this.#fadeWithin = options.fadeWithin ?? kDefaultFadeWithin;
    this.#label = options.label ?? defaultLabel;
    this.#color = options.color ?? (
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

    for (const [clientId, frustum] of this.#peers) {
      frustum.opacity = 1;
      frustum.visible = this.#poses.has(clientId);
    }
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

    for (const [clientId, frustum] of this.#peers) {
      if (this.#poses.has(clientId)) {
        this.#fade(frustum, x, y, z);
      }
    }
  }

  poseOf(
    clientId: string
  ): PeerFrustumPose | undefined {
    const pose = this.#poses.get(clientId);
    if (pose === undefined) {
      return undefined;
    }

    return {
      position: { ...pose.position },
      quaternion: { ...pose.quaternion }
    };
  }

  refreshColors(): void {
    for (const [clientId, frustum] of this.#peers) {
      const identity = this.#room.peers.get(clientId)?.identity ?? {};
      frustum.color = this.#color(clientId, identity);
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
      this.#poses.delete(clientId);

      const frustum = this.#peers.get(clientId);
      if (frustum) {
        frustum.visible = false;
      }

      return;
    }

    this.#poses.set(clientId, pose);

    const frustum = this.#peers.get(clientId) ?? this.#createPeer(clientId, identity);
    frustum.visible = true;
    frustum.position.copy(pose.position);
    frustum.quaternion.copy(pose.quaternion);

    if (this.#source !== undefined) {
      const { x, y, z } = this.#source.position;
      this.#fade(frustum, x, y, z);
    }
  }

  #fade(
    frustum: PeerFrustum,
    x: number,
    y: number,
    z: number
  ): void {
    const distance = Math.hypot(
      frustum.position.x - x,
      frustum.position.y - y,
      frustum.position.z - z
    );

    const opacity = this.#opacityAt(distance);
    frustum.opacity = opacity;
    frustum.visible = opacity > 0;
  }

  #opacityAt(
    distance: number
  ): number {
    if (distance <= this.#hideWithin) {
      return 0;
    }
    if (distance >= this.#fadeWithin) {
      return 1;
    }

    return (distance - this.#hideWithin) /
      (this.#fadeWithin - this.#hideWithin);
  }

  #createPeer(
    clientId: string,
    identity: network.PeerMetadata
  ): PeerFrustum {
    const frustum = new PeerFrustum({
      ...this.#frustumOptions,
      color: this.#color(clientId, identity),
      displayName: this.#label(clientId, identity)
    });
    this.#parent.add(frustum);
    this.#peers.set(clientId, frustum);

    return frustum;
  }

  #removePeer(
    clientId: string
  ): void {
    this.#poses.delete(clientId);

    const frustum = this.#peers.get(clientId);
    if (!frustum) {
      return;
    }

    this.#parent.remove(frustum);
    frustum.dispose();
    this.#peers.delete(clientId);
  }
}
