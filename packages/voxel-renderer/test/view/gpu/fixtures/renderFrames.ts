// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

export function renderFrames(
  renderer: THREE.WebGPURenderer,
  frames: number,
  draw: () => void
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  let remaining = frames;
  void renderer.setAnimationLoop(() => {
    try {
      draw();
    }
    catch (error) {
      void renderer.setAnimationLoop(null);
      reject(error);

      return;
    }
    remaining--;
    if (remaining === 0) {
      void renderer.setAnimationLoop(null);
      resolve();
    }
  });

  return promise;
}
