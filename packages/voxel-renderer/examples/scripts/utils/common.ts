// Import Third-party Dependencies
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// CONSTANTS
const kDefaultLabelStyle: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  color: "#fff",
  fontSize: "11px",
  fontFamily: "monospace",
  background: "rgba(0,0,0,0.65)",
  padding: "2px 7px",
  borderRadius: "3px",
  pointerEvents: "none",
  whiteSpace: "nowrap",
  transform: "translateX(-50%)"
};

// Reusable scratch vector — avoids per-frame allocation in updateLabels.
const kProjVec = new THREE.Vector3();

export interface LabelEntry {
  el: HTMLDivElement;
  worldPos: THREE.Vector3;
}

/**
 * Creates a fixed-position HTML label, appends it to <body>, and returns the
 * entry so the caller can collect it for per-frame projection updates.
 * Pass `style` to override individual properties of the default label style.
 */
export function createLabel(
  text: string,
  worldPos: THREE.Vector3,
  style?: Partial<CSSStyleDeclaration>
): LabelEntry {
  const div = document.createElement("div");
  div.textContent = text;
  Object.assign(div.style, kDefaultLabelStyle, style);
  document.body.appendChild(div);

  return { el: div, worldPos };
}

/**
 * Projects each label's world position into screen space and updates its CSS
 * left/top. Labels behind the camera are hidden via display:none.
 */
export function updateLabels(
  entries: LabelEntry[],
  camera: THREE.Camera
): void {
  const w = window.innerWidth;
  const h = window.innerHeight;

  for (const { el, worldPos } of entries) {
    kProjVec.copy(worldPos).project(camera);

    if (kProjVec.z > 1) {
      el.style.display = "none";
      continue;
    }

    el.style.display = "";
    el.style.left = `${((kProjVec.x * 0.5) + 0.5) * w}px`;
    el.style.top = `${((-kProjVec.y * 0.5) + 0.5) * h}px`;
  }
}

/**
 * Creates a WebGLRenderer fitted to the current window and sets the pixel
 * ratio. The caller is responsible for appending the canvas if needed.
 */
export function createRenderer(
  canvas: HTMLCanvasElement,
  antialias = true
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias });
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
  renderer: THREE.WebGLRenderer
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
 * Creates a PerspectiveCamera (fov 55, near 0.1, far 200) and an OrbitControls
 * instance wired to the given canvas. Both share the same look-at target.
 * Damping is enabled at 0.08 — call controls.update() inside your loop, which
 * startLoop() does automatically.
 */
export function createOrbitCamera(
  canvas: HTMLCanvasElement,
  position: THREE.Vector3Like,
  target: THREE.Vector3Like
): { camera: THREE.PerspectiveCamera; controls: OrbitControls; } {
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(position.x, position.y, position.z);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(target.x, target.y, target.z);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  return { camera, controls };
}

/**
 * Starts the render loop. Each frame it: updates OrbitControls, calls the
 * optional onFrame callback, projects labels, and renders the scene.
 * Also registers the window resize handler so the caller doesn't have to.
 */
// eslint-disable-next-line max-params
export function startLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  labelEntries: LabelEntry[] = [],
  onFrame?: () => void
): void {
  onWindowResize(camera, renderer);

  function animate(): void {
    requestAnimationFrame(animate);
    controls.update();
    onFrame?.();
    updateLabels(labelEntries, camera);
    renderer.render(scene, camera);
  }

  animate();
}
