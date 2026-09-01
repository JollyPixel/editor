// Import Third-party Dependencies
import type * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network";
import { PeerFrustumSync } from "@jolly-pixel/three/network";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";

// Import Internal Dependencies
import {
  peerColor,
  readUsername
} from "../network/identity.ts";

export interface PeerFrustumsOptions {
  room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
  camera: THREE.PerspectiveCamera;
}

export class PeerFrustums extends ActorComponent {
  #sync: PeerFrustumSync<VoxelNetworkCommand, VoxelServerMessage>;
  #camera: THREE.PerspectiveCamera;

  constructor(
    actor: Actor,
    options: PeerFrustumsOptions
  ) {
    super({
      actor,
      typeName: "PeerFrustums"
    });

    this.#camera = options.camera;
    this.#sync = new PeerFrustumSync({
      room: options.room,
      parent: this.actor.world.sceneManager.getSource(),
      label: (_clientId, identity) => readUsername(identity),
      color: (clientId, identity) => peerColor(clientId, identity),
      frustum: {
        showNameBox: true
      }
    });
  }

  awake(): void {
    this.#sync.attach(this.#camera);
  }

  update(): void {
    this.#sync.update();
  }

  override destroy(): void {
    this.#sync.destroy();
    super.destroy();
  }
}
