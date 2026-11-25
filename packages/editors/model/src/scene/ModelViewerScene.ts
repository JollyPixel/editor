// Import Third-party Dependencies
import {
  followCameraPreferences,
  PeerFrustums
} from "@jolly-pixel/editor.host/viewport";
import {
  Systems
} from "@jolly-pixel/ecs";
import {
  bindOrbitFocus,
  OrbitFlyCamera
} from "@jolly-pixel/backend.three";
import type { Room } from "@jolly-pixel/network/client";
import { Teardown } from "@jolly-pixel/utils";
import type { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import type { AnimationPlayer } from "../player/AnimationPlayer.ts";
import type { ModelPreview } from "../preview/ModelPreview.ts";
import { ModelStage } from "./ModelStage.ts";

// CONSTANTS
const kCameraPreset = {
  focusMode: "lock",
  position: { x: 3, y: 2.5, z: 4 },
  pitch: -0.4,
  yaw: 0.6,
  moveSpeed: 2,
  minMoveSpeed: 0.25,
  maxMoveSpeed: 30,
  minPivotDistance: 0.1,
  maxPivotDistance: 200,
  pivotNudgeStep: 0.25,
  pivotMarkerSize: 0.05
} as const;

export interface ModelViewerSceneOptions {
  preview: ModelPreview;
  player: AnimationPlayer;
  preferences: Preferences;
  room: Room;
}

interface ModelViewerParts {
  camera: OrbitFlyCamera;
  frustums: PeerFrustums;
}

export class ModelViewerScene extends Systems.Scene {
  #options: ModelViewerSceneOptions;
  #teardown = new Teardown();
  #parts: ModelViewerParts | null = null;

  constructor(
    options: ModelViewerSceneOptions
  ) {
    super("model-viewer");
    this.#options = options;
  }

  teleportToPeer(
    clientId: string
  ): void {
    const { camera, frustums } = this.#awakened();
    const pose = frustums.peerPose(clientId);
    if (pose !== undefined) {
      camera.teleport(pose);
    }
  }

  override awake(): void {
    const { world } = this;

    const environment = world.sceneManager.graph.createEnvironment(world);
    environment.apply(Systems.ENVIRONMENT_PRESETS.studio);

    const camera = world
      .createActor("viewer-camera")
      .addComponentAndGet(OrbitFlyCamera, kCameraPreset);
    const frustums = world
      .createActor("peer-frustums")
      .addComponentAndGet(PeerFrustums, {
        room: this.#options.room,
        camera: camera.camera
      });
    world
      .createActor("model")
      .addComponent(ModelStage, {
        preview: this.#options.preview,
        player: this.#options.player,
        camera,
        frustums
      });
    this.#parts = {
      camera,
      frustums
    };

    const teardown = this.#teardown;
    teardown.defer(() => environment.dispose());
    teardown.defer(bindOrbitFocus(camera, world.input.keyboard));
    teardown.defer(followCameraPreferences(camera, this.#options.preferences));
  }

  override destroy(): void {
    this.#parts = null;
    this.#teardown.run();
    super.destroy();
  }

  #awakened(): ModelViewerParts {
    if (this.#parts === null) {
      throw new Error("The model viewer scene is not awake.");
    }

    return this.#parts;
  }
}
