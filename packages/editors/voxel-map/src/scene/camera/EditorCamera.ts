// Import Third-party Dependencies
import * as THREE from "three";
import {
  OrbitFlyCamera,
  type CameraPose,
  type Systems
} from "@jolly-pixel/engine";
import { clientToNdc } from "@jolly-pixel/three";
import type { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { PointerCapture } from "../../state/PointerCapture.ts";
import {
  SpawnPose,
  type SpawnLayer
} from "./SpawnPose.ts";
import { ViewRay } from "./ViewRay.ts";
import { CameraPostProcessing } from "./CameraPostProcessing.ts";

// CONSTANTS
const kPivotMaxDistance = 32;
const kPivotFallbackDistance = 24;

export interface EditorCameraOptions {
  world: Systems.World;
  pointer: Pick<PointerCapture, "subscribe">;
  log: Pick<LogQueue, "push">;
  samples?: number;
}

export class EditorCamera {
  #world: Systems.World;
  #log: Pick<LogQueue, "push">;
  #controls: OrbitFlyCamera;
  #viewRay: ViewRay;
  #postProcessing: CameraPostProcessing;
  #disposables: Array<() => void>;
  #pointer = new THREE.Vector2();
  #orbiting = false;
  #spawnPending = true;

  constructor(
    options: EditorCameraOptions
  ) {
    const { world, pointer, log, samples } = options;
    this.#world = world;
    this.#log = log;
    this.#postProcessing = new CameraPostProcessing(
      samples === undefined ? {} : { samples }
    );

    const controls = world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "lock",
        postProcessing: this.#postProcessing.select(false)
      });
    controls.teleport(SpawnPose.frame([]));
    this.#controls = controls;
    this.#viewRay = new ViewRay({
      camera: controls.camera
    });

    this.#disposables = [
      world.input.keyboard.bind("Escape", () => {
        if (!controls.isOrbiting) {
          return false;
        }
        this.exitFocus();

        return true;
      }),
      pointer.subscribe("change", (captured) => {
        controls.enabled = !captured;
      })
    ];
  }

  get camera(): THREE.PerspectiveCamera {
    return this.#controls.camera;
  }

  get glow(): boolean {
    return this.#controls.postProcessing === this.#postProcessing.glow;
  }

  set glow(
    enabled: boolean
  ) {
    this.#controls.postProcessing = this.#postProcessing.select(
      enabled
    );
  }

  focus(
    point: THREE.Vector3Like
  ): void {
    this.#controls.enterOrbitFocus(point);
    this.#announceMode();
  }

  pivotAt(
    solid: THREE.Object3D | null,
    pointer: THREE.Vector2
  ): void {
    this.focus(
      this.#viewRay.pivotPoint(solid, {
        pointer,
        maxDistance: kPivotMaxDistance,
        fallbackDistance: kPivotFallbackDistance
      })
    );
  }

  exitFocus(): void {
    this.#controls.exitOrbitFocus();
    this.#announceMode();
  }

  teleport(
    pose: CameraPose
  ): void {
    this.#controls.teleport(pose);
  }

  requestSpawn(): void {
    this.#spawnPending = true;
  }

  spawn(
    layers: Iterable<SpawnLayer>
  ): void {
    if (!this.#spawnPending) {
      return;
    }

    this.#spawnPending = false;
    this.#controls.exitOrbitFocus();
    this.#controls.teleport(
      SpawnPose.frame(layers, {
        fov: this.camera.fov
      })
    );
    this.#announceMode();
  }

  focusPoint(
    solid: THREE.Object3D | null
  ): THREE.Vector3Like {
    return this.#viewRay.focusPoint(solid);
  }

  aimPoint(
    solid: THREE.Object3D | null
  ): THREE.Vector3Like {
    const { mouse } = this.#world.input;

    return mouse.hovering ?
      this.#viewRay.focusPoint(solid, {
        pointer: mouse.viewportPositionTo(this.#pointer)
      }) :
      this.#viewRay.focusPoint(solid);
  }

  pointAt(
    solid: THREE.Object3D | null,
    clientX: number,
    clientY: number
  ): THREE.Vector3Like | null {
    const { canvas } = this.#world.renderer;
    if (document.elementFromPoint(clientX, clientY) !== canvas) {
      return null;
    }

    const pointer = clientToNdc(canvas, clientX, clientY);

    return pointer === null ?
      null :
      this.#viewRay.focusPoint(solid, { pointer });
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
  }

  #announceMode(): void {
    const orbiting = this.#controls.isOrbiting;
    if (orbiting === this.#orbiting) {
      return;
    }

    this.#orbiting = orbiting;
    this.#log.push(
      orbiting
        ? "Camera switched to pivot"
        : "Camera switched to free fly"
    );
  }
}
