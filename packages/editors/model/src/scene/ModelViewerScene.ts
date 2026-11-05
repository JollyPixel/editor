// Import Third-party Dependencies
import { followCameraPreferences } from "@jolly-pixel/editor.host/viewport";
import {
  bindOrbitFocus,
  OrbitFlyCamera,
  Systems
} from "@jolly-pixel/engine";
import { Teardown } from "@jolly-pixel/editor.host";
import type { Preferences } from "@jolly-pixel/preferences";
import * as THREE from "three/webgpu";

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
}

export class ModelViewerScene extends Systems.Scene {
  #options: ModelViewerSceneOptions;
  #teardown = new Teardown();

  constructor(
    options: ModelViewerSceneOptions
  ) {
    super("model-viewer");
    this.#options = options;
  }

  override awake(): void {
    const { world } = this;
    const scene = world.sceneManager.getSource();

    const hemisphere = new THREE.HemisphereLight("#dfe8ff", "#3b3328", 1.2);
    const key = new THREE.DirectionalLight("#ffffff", 2);
    key.position.set(4, 8, 5);
    scene.add(hemisphere, key);

    const environment = new Systems.SceneEnvironment(world);
    environment.apply({
      background: null,
      environment: {
        kind: "room",
        intensity: 0.6
      },
      fog: {
        kind: "none"
      }
    });

    const camera = world
      .createActor("viewer-camera")
      .addComponentAndGet(OrbitFlyCamera, kCameraPreset);
    world
      .createActor("model")
      .addComponent(ModelStage, {
        preview: this.#options.preview,
        player: this.#options.player,
        camera
      });

    const teardown = this.#teardown;
    teardown.defer(() => scene.remove(hemisphere, key));
    teardown.defer(() => environment.dispose());
    teardown.defer(bindOrbitFocus(camera, world.input.keyboard));
    teardown.defer(followCameraPreferences(camera, this.#options.preferences));
  }

  override destroy(): void {
    this.#teardown.run();
    super.destroy();
  }
}
