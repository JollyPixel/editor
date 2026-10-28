// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Transform } from "../../../src/actor/Transform.ts";
import { ActorComponents } from "../../../src/actor/ActorComponents.ts";
import { ActorRegistry } from "../../../src/systems/scene/ActorRegistry.ts";
import {
  OrbitFlyCamera,
  type OrbitFlyCameraOptions
} from "../../../src/components/camera/orbit-fly/OrbitFlyCamera.ts";
import type { Actor } from "../../../src/actor/Actor.ts";

// CONSTANTS
const kFrame = 1 / 60;

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
  readonly offset: THREE.Vector3;
  object: THREE.Object3D;
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
  sceneChildren: THREE.Object3D[];
  keepAlives: Array<() => boolean>;
  invalidations: () => number;
  hold(...codes: string[]): void;
  advance(frames?: number, deltaTime?: number): void;
  lookDrag(deltaX: number, deltaY: number, button?: "middle" | "left"): void;
  stopLookDrag(): void;
  scroll(amount: number): void;
  swipe(x: number, y: number): void;
  pressOnce(...codes: string[]): void;
}

export function createHarness(
  options: OrbitFlyCameraOptions = {}
): CameraHarness {
  const held = new Set<string>();
  const sceneRoot = new THREE.Object3D();
  const body = new THREE.Object3D();
  const keepAlives: Array<() => boolean> = [];

  let invalidations = 0;
  let middleDown = false;
  let leftDown = false;
  let mouseMoving = false;
  let mouseDelta = { x: 0, y: 0 };
  let scrollX = 0;
  let scrollY = 0;
  let scrollSource: "wheel" | "touchpad" = "wheel";
  let justPressed = new Set<string>();

  const actorValue = {
    components: new ActorComponents(),
    transform: new Transform(body),
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
          wasDownLastUpdate: (code: string) => held.has(code),
          wasJustPressed: (code: string) => justPressed.has(code),
          wasJustReleased: () => false
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
            out.x = scrollX;
            out.y = scrollY;

            return out;
          },
          get scrollSource() {
            return scrollX === 0 && scrollY === 0 ? null : scrollSource;
          }
        }
      },
      sceneManager: {
        actors: new ActorRegistry(sceneRoot),
        getSource: () => sceneRoot
      }
    }
  };
  const actor = actorValue as unknown as Actor;
  const camera = new OrbitFlyCamera(actor, options);
  const start = body.position.clone();

  return {
    camera,
    get offset() {
      return body.position.clone().sub(start);
    },
    object: body,
    position: body.position,
    orientation: body.quaternion,
    sceneChildren: sceneRoot.children,
    keepAlives,
    invalidations: () => invalidations,
    hold(...codes: string[]): void {
      held.clear();
      for (const code of codes) {
        held.add(code);
      }
    },
    advance(frames = 1, deltaTime = kFrame): void {
      actorValue.world.time.unscaledDelta = deltaTime;
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
      scrollX = 0;
      scrollY = amount;
      scrollSource = "wheel";
    },
    swipe(x: number, y: number): void {
      scrollX = x;
      scrollY = y;
      scrollSource = "touchpad";
    },
    pressOnce(...codes: string[]): void {
      justPressed = new Set(codes);
    }
  };
}
