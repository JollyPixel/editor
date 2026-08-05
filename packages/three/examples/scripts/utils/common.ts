// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * Creates and initializes a WebGPURenderer fitted to the current window.
 * Unlike WebGLRenderer's synchronous constructor, WebGPURenderer requires
 * `await renderer.init()` before first use (it auto-detects a WebGPU or
 * WebGL2 backend depending on browser support).
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  antialias = true
): Promise<THREE.WebGPURenderer> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias });
  await renderer.init();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  return renderer;
}

/**
 * Registers a window resize listener that keeps the camera aspect ratio and
 * renderer size in sync with the window dimensions.
 */
export function onWindowResize(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGPURenderer
): void {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

/**
 * Creates a Scene with a solid background colour (default: #1a1a2e).
 */
export function createScene(
  background: THREE.ColorRepresentation = "#1a1a2e"
): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  return scene;
}

/**
 * Creates a PerspectiveCamera (fov 55, near 0.1, far 500) and an OrbitControls
 * instance wired to the given canvas. Both share the same look-at target.
 * Damping is enabled at 0.08 — call controls.update() inside your loop, which
 * startLoop() does automatically.
 */
export function createOrbitCamera(
  canvas: HTMLCanvasElement,
  position: THREE.Vector3Like,
  target: THREE.Vector3Like
): { camera: THREE.PerspectiveCamera; controls: OrbitControls; } {
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(position.x, position.y, position.z);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(target.x, target.y, target.z);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  return { camera, controls };
}

/**
 * Starts the render loop via `renderer.setAnimationLoop`, which is what
 * WebGPURenderer expects to drive rendering (its `.render()` is internally
 * async, unlike WebGLRenderer's synchronous `render()` + `requestAnimationFrame`).
 * Also registers the window resize handler so the caller doesn't have to.
 */
export function startLoop(
  options: {
    renderer: THREE.WebGPURenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    onFrame?: () => void;
  }
): void {
  const { renderer, scene, camera, controls, onFrame } = options;

  onWindowResize(camera, renderer);

  renderer.setAnimationLoop(() => {
    controls.update();
    onFrame?.();
    renderer.render(scene, camera);
  });
}
