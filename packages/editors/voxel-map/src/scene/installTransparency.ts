// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import { VoxelTransparencyRenderer } from "@jolly-pixel/voxel.renderer";

/**
 * Installs scene compositing for the editor's cameras and releases it on exit.
 */
export function installTransparency(
  renderer: Systems.Renderer
): () => void {
  if (!(renderer instanceof Systems.ThreeRenderer)) {
    return () => void 0;
  }

  const previous = renderer.renderStrategy;
  const source = renderer.getSource();
  const transparency = new VoxelTransparencyRenderer(source);
  const strategy: typeof previous = {
    render(scene, { components, canvasWidth, canvasHeight }) {
      for (const component of components) {
        component.prepareRender(
          canvasWidth,
          canvasHeight
        );

        const viewport = component.viewport ?? {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        };
        source.setViewport(
          Math.round(viewport.x * canvasWidth),
          Math.round(viewport.y * canvasHeight),
          Math.round(viewport.width * canvasWidth),
          Math.round(viewport.height * canvasHeight)
        );
        transparency.render(
          scene,
          component.threeCamera
        );
      }
    },
    resize(width, height) {
      previous.resize(width, height);
    },
    dispose() {
      transparency.dispose();
    }
  };
  renderer.renderStrategy = strategy;

  return () => {
    if (renderer.renderStrategy === strategy) {
      renderer.renderStrategy = previous;
    }
    transparency.dispose();
  };
}
