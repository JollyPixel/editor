// Import Internal Dependencies
import ThreeSceneManager from "./threeScene.js";
import "./components/LeftPanel.ts";
import "./components/RightPanel.js";
import "./components/Resizer.js";

const kBody = document.querySelector("body") as HTMLBodyElement;
const leftPanel = document.querySelector("jolly-model-editor-left-panel") as HTMLElement;
const rightPanel = document.querySelector("jolly-model-editor-right-panel") as HTMLElement;
const kSection = document.getElementById("threeRenderer") as HTMLDivElement;

const kMinWidth = 300;

const threeSceneManager = new ThreeSceneManager(kSection);

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

    const leftPanelComponent = leftPanel as any;

    // Essayer d'abord via le getSharedCanvasManager
    const sharedManager = leftPanelComponent.getSharedCanvasManager?.();
    if (sharedManager) {
      sharedManager.onResize();
    }
    // Sinon, essayer via activeComponent
    else {
      const activeComponent = leftPanelComponent.getActiveComponent();
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

rightPanel.addEventListener("addcube", () => {
  threeSceneManager.createCube();
});

