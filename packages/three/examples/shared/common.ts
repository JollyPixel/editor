// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export async function createRenderer(
  canvas: HTMLCanvasElement,
  antialias = true
): Promise<THREE.WebGPURenderer> {
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias
  });
  await renderer.init();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  return renderer;
}

export function onWindowResize(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGPURenderer
): void {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
  });
}

export function createScene(
  background: THREE.ColorRepresentation = "#1a1a2e"
): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(
    background
  );

  return scene;
}

export interface CreateOrbitCameraResult {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
}

export function createOrbitCamera(
  canvas: HTMLCanvasElement,
  position: THREE.Vector3Like,
  target: THREE.Vector3Like
): CreateOrbitCameraResult {
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(
    position.x,
    position.y,
    position.z
  );

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

  return { camera, controls };
}

export interface UpdatableControls {
  update(): void;
}

export interface StartLoopOptions {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  controls: UpdatableControls;
  onFrame?: () => void;
  onBeforeRender?: () => void;
  onAfterRender?: () => void;

  render?: () => void;
}

export function startLoop(
  options: StartLoopOptions
): void {
  const {
    renderer,
    scene,
    camera,
    controls,
    onFrame,
    onBeforeRender,
    onAfterRender,
    render = () => renderer.render(scene, camera)
  } = options;

  onWindowResize(camera, renderer);

  renderer.setAnimationLoop(() => {
    controls.update();
    onFrame?.();
    onBeforeRender?.();
    renderer.render(scene, camera);
    render();
    onAfterRender?.();
  });
}
