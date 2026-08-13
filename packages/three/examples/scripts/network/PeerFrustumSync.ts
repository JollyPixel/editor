// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";
import type * as THREE from "three";

// Import Internal Dependencies
import { ColorPalette } from "./ColorPalette.ts";
import {
  PeerFrustum,
  type PeerFrustumOptions
} from "../../../src/index.ts";
import {
  isPeerFrustumPresence,
  peerFrustumPresenceEqual,
  type PeerFrustumPresence
} from "./types.ts";

// CONSTANTS
const kPresenceFrustumKey = "frustum";

export interface PeerFrustumSyncOptions<ClientMessage = unknown, ServerMessage = unknown> {
  room: network.Room<ClientMessage, ServerMessage>;
  /**
   * Object3D remote peers' frustums are added to/removed from (typically the scene).
   */
  parent: THREE.Object3D;
  /**
   * Extracts a display label from a peer's identity.
   * @default reads `identity.username` when it's a string
   */
  getLabel?: (identity: network.PeerMetadata) => string | undefined;
  /**
   * Chooses the color shared by a remote peer's frustum and other presence UI.
   * @default a deterministic color from the built-in palette
   */
  getColor?: (clientId: string) => THREE.ColorRepresentation;
  /**
   * Shared visual options applied to every remote peer's frustum.
   * `color` and `displayName` are driven by presence/identity instead and ignored here.
   */
  frustum?: Omit<PeerFrustumOptions, "color" | "displayName">;
}

function defaultGetLabel(
  identity: network.PeerMetadata
): string | undefined {
  return typeof identity.username === "string" ? identity.username : undefined;
}

/**
 * Broadcasts the local entity/player's position and orientation over a
 * `network.Room`'s presence channel and mirrors remote peers' poses onto
 * `PeerFrustum` instances added to `parent`.
 */
export class PeerFrustumSync<ClientMessage = unknown, ServerMessage = unknown> {
  #room: network.Room<ClientMessage, ServerMessage>;
  #parent: THREE.Object3D;
  #getLabel: (identity: network.PeerMetadata) => string | undefined;
  #getColor: (clientId: string) => THREE.ColorRepresentation;
  #frustumOptions: Omit<PeerFrustumOptions, "color" | "displayName">;
  #palette = new ColorPalette();
  #peers = new Map<string, PeerFrustum>();
  #source: THREE.Object3D | undefined;
  #lastSent: PeerFrustumPresence | null | undefined;

  #onPeerJoined = (
    event: network.RoomPeerEvent
  ): void => {
    this.#syncPeer(event.clientId);
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
    this.#getLabel = options.getLabel ?? defaultGetLabel;
    this.#getColor = options.getColor ?? (
      (clientId) => this.#palette.forKey(clientId)
    );
    this.#frustumOptions = options.frustum ?? {};

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
    this.#lastSent = undefined;
  }

  destroy(): void {
    this.detach();
    this.#room.off("peer-joined", this.#onPeerJoined);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);

    for (const clientId of [...this.#peers.keys()]) {
      this.#removePeer(clientId);
    }
  }

  /**
   * Reads the attached source's current position/orientation and reports it
   * as a presence update if it changed since the last call, then picks up
   * any peer this session doesn't know about yet. Call once per render tick
   * (e.g. from the host's animation loop).
   *
   * The reconcile step matters on join: the room's initial "sync" snapshot
   * populates `room.peers` directly without emitting "peer-joined" for each
   * already-connected peer (see `network.Room`'s docs), and it can arrive
   * after `attach()` has already run its one-shot seed. Repeating the check
   * every tick means an already-connected peer always shows up on the next
   * frame, regardless of that race.
   */
  update(): void {
    this.#reconcilePeers();
    this.#refreshColors();

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

  #reportLocal(
    pose: PeerFrustumPresence
  ): void {
    if (
      this.#lastSent !== undefined &&
      peerFrustumPresenceEqual(pose, this.#lastSent)
    ) {
      return;
    }

    this.#lastSent = pose;
    this.#room.updatePresence({
      [kPresenceFrustumKey]: pose
    });
  }

  /**
   * Creates a frustum for any peer already in `room.peers` that this session
   * hasn't seen yet. A no-op for peers already tracked — their pose updates
   * keep flowing through the "peer-presence" listener.
   */
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
    if (!(kPresenceFrustumKey in patch)) {
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
    const rawPose = presence[kPresenceFrustumKey];

    if (!isPeerFrustumPresence(rawPose)) {
      const frustum = this.#peers.get(clientId);
      if (frustum) {
        frustum.visible = false;
      }

      return;
    }

    // Color/name are set once at creation, not re-applied on every pose
    // update — PeerFrustum's nameplate is a canvas texture, expensive to
    // redraw at the rate poses stream in.
    const frustum = this.#peers.get(clientId) ?? this.#createPeer(clientId, identity);
    frustum.visible = true;
    frustum.position.copy(rawPose.position);
    frustum.quaternion.copy(rawPose.quaternion);
  }

  #createPeer(
    clientId: string,
    identity: network.PeerMetadata
  ): PeerFrustum {
    const frustum = new PeerFrustum({
      ...this.#frustumOptions,
      color: this.#getColor(clientId),
      displayName: this.#getLabel(identity)
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

  #refreshColors(): void {
    for (const [clientId, frustum] of this.#peers) {
      frustum.color = this.#getColor(clientId);
    }
  }
}
