// Import Internal Dependencies
import ThreeSceneManager from "./three/ThreeSceneManager.js";
import "./components/LeftPanel.ts";
import "./components/RightPanel.js";
import "./components/PopupManager.js";
import "./components/popups/index.js";
import "./components/Resizer.js";

const kBody = document.querySelector("body") as HTMLBodyElement;
const leftPanel = document.querySelector("jolly-model-editor-left-panel") as HTMLElement;
const rightPanel = document.querySelector("jolly-model-editor-right-panel") as HTMLElement;
const popupManager = document.querySelector("jolly-popup-manager") as HTMLElement;
const kSection = document.getElementById("threeRenderer") as HTMLDivElement;

const kMinWidth = 300;

const threeSceneManager = new ThreeSceneManager(kSection);

// Give RightPanel access to ModelManager and PopupManager
(rightPanel as any).setModelManager(threeSceneManager.getModelManager());
(rightPanel as any).setPopupManager(popupManager);
(popupManager as any).setSceneManager(threeSceneManager);

function updateCanvasTexture() {
  const leftPanelComponent = leftPanel as any;
  const canvasManager = leftPanelComponent.getSharedCanvasManager();
  if (canvasManager) {
    threeSceneManager.setCanvasTexture(canvasManager);
  }
}

requestAnimationFrame(function updateLoop() {
  updateCanvasTexture();
  requestAnimationFrame(updateLoop);
});

kBody.addEventListener("resizer", (e: Event) => {
  const customEvent = e as CustomEvent;
  const { delta, name } = customEvent.detail;

  function triggerManagerResize() {
    threeSceneManager.onResize();

    // Essayer d'abord via le getSharedCanvasManager
    const sharedManager = (leftPanel as any).getSharedCanvasManager?.();
    if (sharedManager) {
      sharedManager.onResize();
    }
    // Sinon, essayer via activeComponent
    else {
      const activeComponent = (leftPanel as any).getActiveComponent();
      if (activeComponent && activeComponent.canvasManagerInstance) {
        activeComponent.canvasManagerInstance.onResize();
      }
    }
  }

  if (name === "leftPanel-threejs") {
    const leftWidth = parseInt(getComputedStyle(leftPanel).width, 10);
    const sectionWidth = parseInt(getComputedStyle(kSection).width, 10);
    const newLeftWidth = leftWidth + delta;
    const newSectionWidth = sectionWidth - delta;

    if (newSectionWidth >= kMinWidth) {
      leftPanel.style.width = `${newLeftWidth}px`;
      triggerManagerResize();
    }
  }
  else if (name === "threejs-rightPanel") {
    const rightWidth = parseInt(getComputedStyle(rightPanel).width, 10);
    const sectionWidth = parseInt(getComputedStyle(kSection).width, 10);
    const newRightWidth = rightWidth - delta;
    const newSectionWidth = sectionWidth + delta;

    if (newSectionWidth >= kMinWidth && newRightWidth >= kMinWidth) {
      rightPanel.style.width = `${newRightWidth}px`;
      triggerManagerResize();
    }
  }
});

rightPanel.addEventListener("addcube", (e: any) => {
  const { name } = e.detail;
  threeSceneManager.createCube(name);
});

