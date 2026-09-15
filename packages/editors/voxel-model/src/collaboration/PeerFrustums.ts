// Import Third-party Dependencies
import type * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network";
import {
  PeerFrustumSync,
  type PeerFrustumPose
} from "@jolly-pixel/three/network";

// Import Internal Dependencies
import type {
  ModelNetworkCommand,
  ModelServerMessage
} from "../network/types.ts";
import {
  peerColor,
  readUsername
} from "./identity.ts";

// CONSTANTS
const kHideWithin = 1.5;
const kFadeWithin = 5;

export interface PeerFrustumsOptions {
  room: network.Room<ModelNetworkCommand, ModelServerMessage>;
  camera: THREE.PerspectiveCamera;
}

export class PeerFrustums extends ActorComponent {
  #sync: PeerFrustumSync;
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
      hideWithin: kHideWithin,
      fadeWithin: kFadeWithin,
      frustum: {
        showNameBox: true
      }
    });
  }

  awake(): void {
    this.#sync.attach(this.#camera);
  }

  poseOf(
    clientId: string
  ): PeerFrustumPose | undefined {
    return this.#sync.poseOf(clientId);
  }

  update(): void {
    this.#sync.update();
  }

  override destroy(): void {
    this.#sync.destroy();
    super.destroy();
  }
}
