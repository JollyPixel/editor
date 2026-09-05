// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * Creates a `WebGPURenderer` fitted to the current window.
 */
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

/**
 * Keeps camera aspect and renderer size in sync with the window.
 */
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

/**
 * Creates a `Scene` with a solid background color.
 */
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

/**
 * Creates a `PerspectiveCamera` and `OrbitControls` wired to the canvas.
 */
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
  /**
   * Anything exposing a parameterless `update()`, called once per frame
   * before rendering — `OrbitControls` and `createFreeFlyCamera`'s
   * `controls` both satisfy this.
   */
  controls: UpdatableControls;
  onFrame?: () => void;
  onBeforeRender?: () => void;
  onAfterRender?: () => void;
  /**
   * Overrides the frame's draw call, in place of the default
   * `renderer.render(scene, camera)` - e.g. a `HighlightPass`'s own
   * `render()`, which must run in `renderer.render`'s place once it owns the
   * frame's `RenderPipeline`.
   */
  render?: () => void;
}

/**
 * Starts the render loop and registers the resize handler.
 */
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
