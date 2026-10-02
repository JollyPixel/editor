// Import Third-party Dependencies
import type * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type { Room } from "@jolly-pixel/network/client";
import {
  PeerFrustumSync,
  type PeerFrustumPose
} from "@jolly-pixel/three/network";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// CONSTANTS
const kHideWithin = 1.5;
const kFadeWithin = 5;

export interface PeerFrustumsOptions {
  room: Room;
  camera: THREE.PerspectiveCamera;
}

export class PeerFrustums extends ActorComponent {
  #sync: PeerFrustumSync;
  #room: Room;
  #camera: THREE.PerspectiveCamera;

  constructor(
    actor: Actor,
    options: PeerFrustumsOptions
  ) {
    super({
      actor,
      typeName: "PeerFrustums"
    });

    this.#room = options.room;
    this.#camera = options.camera;
    this.#sync = new PeerFrustumSync({
      room: options.room,
      parent: this.actor.world.sceneManager.getSource(),
      label: (_clientId, identity) => readUsername(identity),
      color: peerProfileColor,
      hideWithin: kHideWithin,
      fadeWithin: kFadeWithin,
      frustum: {
        showNameBox: true
      },
      requestFrame: () => this.actor.world.invalidate()
    });
  }

  awake(): void {
    this.#sync.attach(this.#camera);

    const { world } = this.actor;
    this.#room.on("sync", this.#onPeersChange);
    this.#room.on("peer-joined", this.#onPeersChange);
    this.addTeardown(
      world.keepAlive(() => this.#room.peers.size > 0)
    );
    this.addTeardown(() => {
      this.#room.off("sync", this.#onPeersChange);
      this.#room.off("peer-joined", this.#onPeersChange);
    });
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

  readonly #onPeersChange = (): void => {
    this.actor.world.invalidate();
  };
}
