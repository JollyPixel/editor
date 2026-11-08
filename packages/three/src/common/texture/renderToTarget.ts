// Import Third-party Dependencies
import * as THREE from "three/webgpu";

export function renderToTarget(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  target: THREE.RenderTarget
): void {
  const renderTarget = renderer.getRenderTarget();
  const { autoClear } = renderer;
  const clearAlpha = renderer.getClearAlpha();
  const clearColor = renderer.getClearColor(new THREE.Color());

  renderer.setRenderTarget(target);
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 0);
  try {
    renderer.render(scene, camera);
  }
  finally {
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.autoClear = autoClear;
    renderer.setRenderTarget(renderTarget);
  }
}
