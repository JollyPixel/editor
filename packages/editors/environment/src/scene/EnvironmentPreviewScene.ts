// Import Third-party Dependencies
import { followCameraPreferences } from "@jolly-pixel/editor.host/viewport";
import {
  Systems
} from "@jolly-pixel/ecs";
import {
  bindOrbitFocus,
  disposeObject3D,
  OrbitFlyCamera
} from "@jolly-pixel/backend.three";
import type { KeyBindingSettings } from "@jolly-pixel/controls";
import type { Preferences } from "@jolly-pixel/preferences";
import { Teardown } from "@jolly-pixel/utils";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { EnvironmentEdits } from "../editing/EnvironmentEdits.ts";
import {
  ENVIRONMENT_HISTORY_SCOPE,
  type EnvironmentHistory
} from "../editing/environmentHistory.ts";
import type { ENVIRONMENT_KEY_BINDINGS } from "../preferences.ts";

// CONSTANTS
const kCameraPreset = {
  focusMode: "lock",
  position: { x: 0, y: 2.2, z: 6.5 },
  pitch: -0.3,
  yaw: 0,
  moveSpeed: 4,
  minMoveSpeed: 0.5,
  maxMoveSpeed: 60,
  maxPivotDistance: 200
} as const;
const kSubjects: ReadonlyArray<{
  x: number;
  color: THREE.ColorRepresentation;
  roughness: number;
  metalness: number;
}> = [
  { x: -2.4, color: "#d9d4cc", roughness: 1, metalness: 0 },
  { x: 0, color: "#c0392b", roughness: 0.35, metalness: 0 },
  { x: 2.4, color: "#c9ccd1", roughness: 0.2, metalness: 1 }
];

export type EnvironmentAction = keyof typeof ENVIRONMENT_KEY_BINDINGS;

export interface EnvironmentPreviewSceneOptions {
  edits: EnvironmentEdits;
  history: Pick<EnvironmentHistory, "undo" | "redo">;
  keyBindings: KeyBindingSettings<EnvironmentAction>;
  preferences: Preferences;
}

export class EnvironmentPreviewScene extends Systems.Scene {
  #options: EnvironmentPreviewSceneOptions;
  #teardown = new Teardown();

  constructor(
    options: EnvironmentPreviewSceneOptions
  ) {
    super("environment-preview");
    this.#options = options;
  }

  override awake(): void {
    const { world } = this;
    const { edits, history, keyBindings, preferences } = this.#options;
    const { scene } = world.sceneManager.graph;
    const teardown = this.#teardown;

    const environment = world.sceneManager.graph.createEnvironment(world);
    function show(): void {
      environment.apply(edits.file);
      world.invalidate();
    }
    show();
    teardown.defer(edits.subscribe("change", show));
    teardown.defer(() => environment.dispose());

    const subjects = createSubjects();
    scene.add(subjects);
    teardown.defer(() => {
      scene.remove(subjects);
      disposeObject3D(subjects);
    });

    const camera = world
      .createActor("preview-camera")
      .addComponentAndGet(OrbitFlyCamera, kCameraPreset);
    teardown.defer(bindOrbitFocus(camera, world.input.keyboard));
    teardown.defer(followCameraPreferences(camera, preferences));
    teardown.defer(keyBindings.bind(world.input.keyboard, {
      "edit.undo": () => {
        history.undo(ENVIRONMENT_HISTORY_SCOPE);
      },
      "edit.redo": () => {
        history.redo(ENVIRONMENT_HISTORY_SCOPE);
      }
    }));
  }

  override destroy(): void {
    this.#teardown.run();
    super.destroy();
  }
}

function createSubjects(): THREE.Group {
  const group = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardNodeMaterial({
      color: "#6d7a5f",
      roughness: 1
    })
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  for (const { x, color, roughness, metalness } of kSubjects) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 48, 24),
      new THREE.MeshStandardNodeMaterial({
        color,
        roughness,
        metalness
      })
    );
    sphere.position.set(x, 0.9, 0);
    group.add(sphere);
  }

  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardNodeMaterial({
      color: "#a87b4f",
      roughness: 0.8
    })
  );
  crate.position.set(-1.2, 0.5, 2);
  crate.rotation.y = 0.4;
  group.add(crate);

  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardNodeMaterial({
      color: "#2b2b2b",
      emissive: "#ffb347",
      emissiveIntensity: 2
    })
  );
  lamp.position.set(1.2, 0.25, 2);
  group.add(lamp);

  return group;
}
