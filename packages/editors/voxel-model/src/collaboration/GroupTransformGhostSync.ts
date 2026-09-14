// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type ModelManager from "../features/groups/ModelManager.ts";
import type { GroupTransformSnapshot } from "../features/groups/hooks.ts";
import type {
  ModelNetworkCommand,
  ModelServerMessage
} from "../network/types.ts";
import { peerColor } from "./identity.ts";

// CONSTANTS
const kPresenceKey = "transformGhost";
const kThrottleMs = 50;
const kExpiryMs = 5000;
const kEdgeOpacity = 0.6;
const kFillOpacity = 0.25;

export interface GroupTransformGhostPayload {
  uuid: string;
  transform: GroupTransformSnapshot;
}

export interface GroupTransformGhostSyncOptions {
  room: network.Room<ModelNetworkCommand, ModelServerMessage>;
  modelManager: ModelManager;
}

interface Ghost {
  object: THREE.Group;
  fill: THREE.Mesh;
  edges: THREE.LineSegments;
  timer: ReturnType<typeof setTimeout>;
}

function decodeGhostPayload(
  value: unknown
): GroupTransformGhostPayload | null {
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

export class GroupTransformGhostSync extends ActorComponent {
  #room: network.Room<ModelNetworkCommand, ModelServerMessage>;
  #modelManager: ModelManager;
  #parent!: THREE.Object3D;
  #ghosts = new Map<string, Ghost>();
  #lastSentAt = 0;

  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    if (!(kPresenceKey in event.patch)) {
      return;
    }

    this.#applyGhost(event.clientId, event.patch[kPresenceKey]);
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#removeGhost(event.clientId);
  };

  constructor(
    actor: Actor,
    options: GroupTransformGhostSyncOptions
  ) {
    super({
      actor,
      typeName: "GroupTransformGhostSync"
    });

    this.#room = options.room;
    this.#modelManager = options.modelManager;

    this.#room.on("peer-presence", this.#onPeerPresence);
    this.#room.on("peer-left", this.#onPeerLeft);
  }

  awake(): void {
    this.#parent = this.actor.world.sceneManager.getSource();
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
      [kPresenceKey]: { uuid, transform }
    });
  }

  clear(): void {
    this.#lastSentAt = 0;
    this.#room.updatePresence({ [kPresenceKey]: null });
  }

  override destroy(): void {
    this.#room.off("peer-presence", this.#onPeerPresence);
    this.#room.off("peer-left", this.#onPeerLeft);

    for (const clientId of [...this.#ghosts.keys()]) {
      this.#removeGhost(clientId);
    }

    super.destroy();
  }

  #applyGhost(
    clientId: string,
    value: unknown
  ): void {
    const payload = decodeGhostPayload(value);
    if (payload === null) {
      this.#removeGhost(clientId);

      return;
    }

    const localGroup = this.#modelManager.getGroupByUUID(payload.uuid);
    if (!localGroup) {
      return;
    }

    let ghost = this.#ghosts.get(clientId);
    if (ghost) {
      clearTimeout(ghost.timer);
    }
    else {
      ghost = {
        ...this.#createGhost(clientId),
        timer: setTimeout(() => this.#removeGhost(clientId), kExpiryMs)
      };
      this.#ghosts.set(clientId, ghost);
    }

    const parentObject = localGroup.getGroup().parent ?? this.#parent;
    if (ghost.object.parent !== parentObject) {
      parentObject.add(ghost.object);
    }

    const { position, rotation, size, scale } = payload.transform;
    ghost.object.position.set(position.x, position.y, position.z);
    ghost.object.rotation.set(rotation.x, rotation.y, rotation.z);
    ghost.object.scale.set(
      size.x * scale.x,
      size.y * scale.y,
      size.z * scale.z
    );
    ghost.timer = setTimeout(() => this.#removeGhost(clientId), kExpiryMs);
  }

  #createGhost(
    clientId: string
  ): Omit<Ghost, "timer"> {
    const profile = this.#room.peers.get(clientId)?.profile;
    const color = peerColor(clientId, profile);
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

    const fill = new THREE.Mesh(
      boxGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: kFillOpacity,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeometry),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: kEdgeOpacity
      })
    );

    const object = new THREE.Group();
    object.add(fill, edges);

    return { object, fill, edges };
  }

  #removeGhost(
    clientId: string
  ): void {
    const ghost = this.#ghosts.get(clientId);
    if (!ghost) {
      return;
    }

    clearTimeout(ghost.timer);
    ghost.object.parent?.remove(ghost.object);
    ghost.fill.geometry.dispose();
    (ghost.fill.material as THREE.Material).dispose();
    ghost.edges.geometry.dispose();
    (ghost.edges.material as THREE.Material).dispose();
    this.#ghosts.delete(clientId);
  }
}
