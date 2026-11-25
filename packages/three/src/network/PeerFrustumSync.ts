// Import Third-party Dependencies
import {
  PresenceChannel,
  parsePeerProfile,
  type PeerMetadata,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";
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

export interface PeerFrustumSyncOptions {
  room: Room;
  parent: THREE.Object3D;
  presenceKey?: string;
  throttleMs?: number;
  hideWithin?: number;
  fadeWithin?: number;
  label?: (
    clientId: string,
    profile: PeerMetadata
  ) => string | undefined;
  color?: (
    clientId: string,
    profile: PeerMetadata
  ) => THREE.ColorRepresentation;
  frustum?: Omit<PeerFrustumOptions, "displayName">;
  requestFrame?: () => void;
}

function defaultLabel(
  _clientId: string,
  profile: PeerMetadata
): string {
  return parsePeerProfile(profile).username;
}

export class PeerFrustumSync {
  #room: Room;
  #channel: PresenceChannel<PeerFrustumPose>;
  #parent: THREE.Object3D;
  #throttleMs: number;
  #hideWithin: number;
  #fadeWithin: number;
  #worldScale = 1;
  #label: NonNullable<PeerFrustumSyncOptions["label"]>;
  #color: PeerFrustumSyncOptions["color"];
  #frustumOptions: Omit<PeerFrustumOptions, "displayName">;
  #requestFrame: () => void;
  #peers = new Map<string, PeerFrustum>();
  #source: THREE.Object3D | undefined;
  #lastSentAt: number | undefined;
  #pendingPose: PeerFrustumPose | null = null;
  #trailingTimer: ReturnType<typeof setTimeout> | null = null;

  #publishPending = (): void => {
    this.#trailingTimer = null;
    const pose = this.#pendingPose;
    if (pose !== null) {
      this.#publish(pose);
    }
  };

  #onPeerChange = (
    change: PresenceChange<PeerFrustumPose>
  ): void => {
    if (change.value !== undefined) {
      this.#showPeer(change.clientId, change.value);
    }
    else if (this.#room.peers.has(change.clientId)) {
      this.#hidePeer(change.clientId);
    }
    else {
      this.#removePeer(change.clientId);
    }
    this.#requestFrame();
  };

  constructor(
    options: PeerFrustumSyncOptions
  ) {
    this.#room = options.room;
    this.#parent = options.parent;
    this.#throttleMs = options.throttleMs ?? kDefaultThrottleMs;
    this.#hideWithin = options.hideWithin ?? kDefaultHideWithin;
    this.#fadeWithin = options.fadeWithin ?? kDefaultFadeWithin;
    this.#label = options.label ?? defaultLabel;
    this.#color = options.color;
    this.#frustumOptions = options.frustum ?? {};
    this.#requestFrame = options.requestFrame ?? (() => undefined);
    this.#channel = new PresenceChannel(options.room, {
      key: options.presenceKey ?? kDefaultPresenceKey,
      decode: decodePeerFrustumPose,
      equals: peerFrustumPoseEqual
    });

    for (const [clientId, pose] of this.#channel.values) {
      this.#showPeer(clientId, pose);
    }
    this.#channel.on("change", this.#onPeerChange);
  }

  get worldScale(): number {
    return this.#worldScale;
  }

  set worldScale(
    value: number
  ) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(
        `"worldScale" (${value}) must be a finite number above 0`
      );
    }

    this.#worldScale = value;
    for (const frustum of this.#peers.values()) {
      frustum.scale.setScalar(value);
    }
    this.#fadeAll();
    this.#requestFrame();
  }

  attach(
    source: THREE.Object3D
  ): void {
    if (this.#source) {
      throw new Error("A source is already attached to this session");
    }

    this.#source = source;
  }

  detach(): void {
    this.#source = undefined;
    this.#cancelPending();

    for (const [clientId, frustum] of this.#peers) {
      frustum.opacity = 1;
      frustum.visible = this.#channel.values.has(clientId);
    }
  }

  destroy(): void {
    this.detach();
    this.#channel.off("change", this.#onPeerChange);
    this.#channel.destroy();

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
    this.#fadeAll();
  }

  peerPose(
    clientId: string
  ): PeerFrustumPose | undefined {
    const pose = this.#channel.values.get(clientId);
    if (pose === undefined) {
      return undefined;
    }

    return {
      position: { ...pose.position },
      quaternion: { ...pose.quaternion }
    };
  }

  refreshColors(): void {
    const color = this.#color;
    if (color === undefined) {
      return;
    }

    for (const [clientId, frustum] of this.#peers) {
      frustum.color = color(clientId, this.#peerProfile(clientId));
    }
  }

  #reportLocal(
    pose: PeerFrustumPose
  ): void {
    const wait = this.#lastSentAt === undefined ?
      0 :
      this.#throttleMs - (Date.now() - this.#lastSentAt);
    if (wait <= 0) {
      this.#publish(pose);

      return;
    }

    this.#pendingPose = pose;
    this.#trailingTimer ??= setTimeout(this.#publishPending, wait);
  }

  #publish(
    pose: PeerFrustumPose
  ): void {
    this.#cancelPending();
    if (this.#channel.publish(pose)) {
      this.#lastSentAt = Date.now();
    }
  }

  #cancelPending(): void {
    if (this.#trailingTimer !== null) {
      clearTimeout(this.#trailingTimer);
      this.#trailingTimer = null;
    }
    this.#pendingPose = null;
  }

  #showPeer(
    clientId: string,
    pose: PeerFrustumPose
  ): void {
    const frustum = this.#peers.get(clientId) ?? this.#createPeer(clientId);
    frustum.visible = true;
    frustum.position.copy(pose.position);
    frustum.quaternion.copy(pose.quaternion);

    if (this.#source !== undefined) {
      const { x, y, z } = this.#source.position;
      this.#fade(frustum, x, y, z);
    }
  }

  #hidePeer(
    clientId: string
  ): void {
    const frustum = this.#peers.get(clientId);
    if (frustum) {
      frustum.visible = false;
    }
  }

  #fadeAll(): void {
    if (!this.#source) {
      return;
    }

    const { x, y, z } = this.#source.position;
    for (const [clientId, frustum] of this.#peers) {
      if (this.#channel.values.has(clientId)) {
        this.#fade(frustum, x, y, z);
      }
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
    const hideWithin = this.#hideWithin * this.#worldScale;
    const fadeWithin = this.#fadeWithin * this.#worldScale;
    if (distance <= hideWithin) {
      return 0;
    }
    if (distance >= fadeWithin) {
      return 1;
    }

    return (distance - hideWithin) / (fadeWithin - hideWithin);
  }

  #peerProfile(
    clientId: string
  ): PeerMetadata {
    return this.#room.peers.get(clientId)?.profile ?? {};
  }

  #createPeer(
    clientId: string
  ): PeerFrustum {
    const profile = this.#peerProfile(clientId);
    const frustum = new PeerFrustum({
      ...this.#frustumOptions,
      ...this.#color && {
        color: this.#color(clientId, profile)
      },
      displayName: this.#label(clientId, profile)
    });
    frustum.scale.setScalar(this.#worldScale);
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
