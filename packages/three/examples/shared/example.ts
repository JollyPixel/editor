// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Pane } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { createExamplePane } from "./example-pane.ts";
import {
  mountPerformanceStats,
  type PerformanceStats
} from "./performance-stats.ts";

// CONSTANTS
const kFieldOfView = 55;
const kNearPlane = 0.1;
const kFarPlane = 500;
const kDefaultBackground = "#1a1a2e";

export interface UpdatableControls {
  update(): void;
}

export interface ExampleCamera<
  TControls extends UpdatableControls
> {
  camera: THREE.PerspectiveCamera;
  controls: TControls;
}

export type ExampleCameraFactory<
  TControls extends UpdatableControls = UpdatableControls
> = (canvas: HTMLCanvasElement) => ExampleCamera<TControls>;

export interface CreateExampleOptions<
  TControls extends UpdatableControls
> {
  title: string;
  camera: ExampleCameraFactory<TControls>;
  background?: THREE.ColorRepresentation;
  stats?: boolean;
}

export interface StartOptions {
  update?: () => void;
  render?: () => void;
}

export interface Example<
  TControls extends UpdatableControls = UpdatableControls
> {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: TControls;
  pane: Pane;
  stats: PerformanceStats;
  start: (options?: StartOptions) => void;
}

export async function createExample<
  TControls extends UpdatableControls
>(
  options: CreateExampleOptions<TControls>
): Promise<Example<TControls>> {
  const {
    title,
    camera: cameraFactory,
    background = kDefaultBackground,
    stats: withStats = true
  } = options;

  const canvas = document.querySelector("canvas");
  if (canvas === null) {
    throw new Error("createExample: no canvas in this page's HTML");
  }

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true
  });
  await renderer.init();
  renderer.setPixelRatio(
    window.devicePixelRatio
  );
  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const { camera, controls } = cameraFactory(canvas);
  const pane = createExamplePane({
    title
  });
  const stats = withStats ?
    mountPerformanceStats(renderer) :
    noPerformanceStats();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
  });

  function start(
    startOptions: StartOptions = {}
  ): void {
    const {
      update,
      render = () => renderer.render(scene, camera)
    } = startOptions;

    renderer.setAnimationLoop(() => {
      controls.update();
      update?.();
      stats.begin();
      render();
      stats.end();
    });
  }

  return {
    canvas,
    renderer,
    scene,
    camera,
    controls,
    pane,
    stats,
    start
  };
}

function noPerformanceStats(): PerformanceStats {
  return {
    begin: () => void 0,
    end: () => void 0,
    dispose: () => void 0
  };
}

export function perspectiveCamera(
  position: THREE.Vector3Like
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    kFieldOfView,
    window.innerWidth / window.innerHeight,
    kNearPlane,
    kFarPlane
  );
  camera.position.set(
    position.x,
    position.y,
    position.z
  );

  return camera;
}

export function orbitCamera(
  position: THREE.Vector3Like,
  target: THREE.Vector3Like
): ExampleCameraFactory<OrbitControls> {
  return (canvas) => {
    const camera = perspectiveCamera(position);

    const controls = new OrbitControls(
      camera,
      canvas
    );
    controls.target.set(
      target.x,
      target.y,
      target.z
    );
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    return {
      camera,
      controls
    };
  };
}
