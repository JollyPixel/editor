// Import Third-party Dependencies
import "@jolly-pixel/ui";

// Import Internal Dependencies
import ThreeSceneManager from "./three/ThreeSceneManager.ts";
import "./components/LeftPanel.ts";
import "./components/RightPanel.ts";

const leftPanel = document.querySelector("jolly-model-editor-left-panel") as HTMLElement;
const rightPanel = document.querySelector("jolly-model-editor-right-panel") as HTMLElement;
const kSection = document.getElementById("threeRenderer") as HTMLDivElement;
const leftDock = document.querySelector("jolly-dock[side='left']") as HTMLElement;
const rightDock = document.querySelector("jolly-dock[side='right']") as HTMLElement;

const threeSceneManager = new ThreeSceneManager(kSection);

// Give RightPanel access to ModelManager and the scene's control-enable switch
(rightPanel as any).setModelManager(threeSceneManager.getModelManager());
(rightPanel as any).setSceneManager(threeSceneManager);

function updateCanvasTexture() {
  const leftPanelComponent = leftPanel as any;
  const canvasManager = leftPanelComponent.getSharedPixelArtCanvas();
  if (canvasManager) {
    threeSceneManager.setCanvasTexture(canvasManager);
  }
}

requestAnimationFrame(function updateLoop() {
  updateCanvasTexture();
  requestAnimationFrame(updateLoop);
});

function triggerManagerResize() {
  threeSceneManager.onResize();

  const sharedManager = (leftPanel as any).getSharedPixelArtCanvas?.();
  if (sharedManager) {
    sharedManager.onResize();
  }
  else {
    const activeComponent = (leftPanel as any).getActiveComponent();
    if (activeComponent && activeComponent.canvasManagerInstance) {
      activeComponent.canvasManagerInstance.onResize();
    }
  }
}

// `jolly-dock` owns resizing (pointer, keyboard, collapse) and clamps
// between `min-size`/`max-size` itself; this only re-fits the 3D viewport
// and the shared canvas as the docks' width changes.
leftDock.addEventListener("jolly-resize", triggerManagerResize);
rightDock.addEventListener("jolly-resize", triggerManagerResize);

rightPanel.addEventListener("addcube", (e: any) => {
  const { name } = e.detail;
  threeSceneManager.createCube(name);
});
