// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  OrbitFlyCamera,
  type OrbitFlyCameraOptions
} from "../../src/components/camera/orbit-fly/OrbitFlyCamera.ts";
import type { Actor } from "../../src/actor/Actor.ts";

// CONSTANTS
const kFrame = 1 / 60;
const kUp = new THREE.Vector3(0, 1, 0);

export function pivotArray(
  pivot: THREE.Vector3Like | null
): [number, number, number] | null {
  return pivot === null ? null : [pivot.x, pivot.y, pivot.z];
}

export function unusedPostProcessing(): never {
  throw new Error("not rendered in this test");
}

export interface CameraHarness {
  camera: OrbitFlyCamera;
  offset: THREE.Vector3;
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
  sceneChildren: THREE.Object3D[];
  keepAlives: Array<() => boolean>;
  invalidations: () => number;
  hold(...codes: string[]): void;
  advance(frames?: number): void;
  lookDrag(deltaX: number, deltaY: number, button?: "middle" | "left"): void;
  stopLookDrag(): void;
  scroll(amount: number): void;
  pressOnce(...codes: string[]): void;
}

export function createHarness(
  options: OrbitFlyCameraOptions = {}
): CameraHarness {
  const held = new Set<string>();
  const offset = new THREE.Vector3();
  const position = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const sceneRoot = new THREE.Object3D();
  const lookMatrix = new THREE.Matrix4();
  const keepAlives: Array<() => boolean> = [];

  let invalidations = 0;
  let middleDown = false;
  let leftDown = false;
  let mouseMoving = false;
  let mouseDelta = { x: 0, y: 0 };
  let scrollY = 0;
  let justPressed = new Set<string>();

  const actorValue = {
    components: [],
    componentsRequiringUpdate: [],
    transform: {
      setLocalPosition: (value: THREE.Vector3Like) => {
        position.set(value.x, value.y, value.z);
      },
      setLocalOrientation: (value: THREE.QuaternionLike) => {
        orientation.set(value.x, value.y, value.z, value.w);
      },
      getForward: (out: THREE.Vector3) => out.set(0, 0, -1),
      getGlobalPosition: (out: THREE.Vector3) => out.copy(position),
      lookAt: (target: THREE.Vector3Like) => {
        lookMatrix.lookAt(position, new THREE.Vector3(target.x, target.y, target.z), kUp);
        orientation.setFromRotationMatrix(lookMatrix);
      },
      moveGlobal: (delta: THREE.Vector3) => {
        offset.add(delta);
        position.add(delta);
      }
    },
    world: {
      time: {
        delta: kFrame,
        unscaledDelta: kFrame
      },
      audio: {},
      invalidate: () => {
        invalidations++;
      },
      keepAlive: (predicate: () => boolean) => {
        keepAlives.push(predicate);

        return () => {
          keepAlives.splice(keepAlives.indexOf(predicate), 1);
        };
      },
      renderer: {
        addRenderComponent: () => void 0,
        removeRenderComponent: () => void 0
      },
      input: {
        keyboard: {
          isDown: (code: string) => held.has(code),
          wasJustPressed: (code: string) => justPressed.has(code)
        },
        mouse: {
          isDown: (button: string) => {
            if (button === "middle") {
              return middleDown;
            }

            return button === "left" && leftDown;
          },
          isMoving: () => mouseMoving,
          viewportDelta: () => {
            return { x: mouseDelta.x, y: mouseDelta.y };
          },
          scrollTo: <T extends { x: number; y: number; }>(out: T) => {
            out.x = 0;
            out.y = scrollY;

            return out;
          }
        }
      },
      sceneManager: {
        scheduleStart: () => void 0,
        cancelStart: () => void 0,
        getSource: () => sceneRoot
      }
    }
  };
  const actor = actorValue as unknown as Actor;
  const camera = new OrbitFlyCamera(actor, options);

  return {
    camera,
    offset,
    position,
    orientation,
    sceneChildren: sceneRoot.children,
    keepAlives,
    invalidations: () => invalidations,
    hold(...codes: string[]): void {
      held.clear();
      for (const code of codes) {
        held.add(code);
      }
    },
    advance(frames = 1): void {
      for (let index = 0; index < frames; index++) {
        camera.update();
        justPressed.clear();
      }
    },
    lookDrag(deltaX: number, deltaY: number, button: "middle" | "left" = "middle"): void {
      if (button === "middle") {
        middleDown = true;
      }
      else {
        leftDown = true;
      }
      mouseMoving = true;
      mouseDelta = { x: deltaX, y: deltaY };
    },
    stopLookDrag(): void {
      middleDown = false;
      leftDown = false;
      mouseMoving = false;
      mouseDelta = { x: 0, y: 0 };
    },
    scroll(amount: number): void {
      scrollY = amount;
    },
    pressOnce(...codes: string[]): void {
      justPressed = new Set(codes);
    }
  };
}
