// Import Third-party Dependencies
import { ResizeHandle } from "@jolly-pixel/resize-handle";

// Import Internal Dependencies
import ThreeSceneManager from "./three/ThreeSceneManager.ts";
import "./components/LeftPanel.ts";
import "./components/RightPanel.ts";
import "./components/PopupManager.ts";
import "./components/popups/index.ts";

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

function triggerManagerResize() {
  threeSceneManager.onResize();

  const sharedManager = (leftPanel as any).getSharedCanvasManager?.();
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

// direction "left" → handle div inserted AFTER leftPanel (between leftPanel and threeRenderer)
// dragging right → leftPanel.style.width increases
const leftResizeHandle = new ResizeHandle(leftPanel, { direction: "left" });

leftResizeHandle.addEventListener("drag", () => {
  const sectionWidth = kSection.getBoundingClientRect().width;

  if (sectionWidth < kMinWidth) {
    const excess = kMinWidth - sectionWidth;
    leftPanel.style.width = `${parseInt(getComputedStyle(leftPanel).width, 10) - excess}px`;
  }

  triggerManagerResize();
});

// direction "right" → handle div inserted BEFORE rightPanel (between threeRenderer and rightPanel)
// dragging left → rightPanel.style.width increases
const rightResizeHandle = new ResizeHandle(rightPanel, { direction: "right" });

rightResizeHandle.addEventListener("drag", () => {
  const sectionWidth = kSection.getBoundingClientRect().width;
  const rightWidth = parseInt(getComputedStyle(rightPanel).width, 10);

  if (sectionWidth < kMinWidth) {
    const excess = kMinWidth - sectionWidth;
    rightPanel.style.width = `${rightWidth - excess}px`;
  }
  else if (rightWidth < kMinWidth) {
    rightPanel.style.width = `${kMinWidth}px`;
  }

  triggerManagerResize();
});

rightPanel.addEventListener("addcube", (e: any) => {
  const { name } = e.detail;
  threeSceneManager.createCube(name);
});
