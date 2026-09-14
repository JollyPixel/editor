// Import Third-party Dependencies
import { Runtime } from "@jolly-pixel/runtime";
import { inputLayers } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { ModelEditorScene } from "./app/ModelEditorScene.ts";
import "./app/LeftPanel.ts";
import "./app/RightPanel.ts";
import CubeUvSync from "./features/texture-uv/CubeUvSync.ts";

const leftPanel = document.querySelector("jolly-model-editor-left-panel") as HTMLElement;
const rightPanel = document.querySelector("jolly-model-editor-right-panel") as HTMLElement;
const leftDock = document.querySelector("jolly-dock[side='left']") as HTMLElement;
const rightDock = document.querySelector("jolly-dock[side='right']") as HTMLElement;

const runtime = await Runtime.create("#threeRenderer canvas", {
  focusCanvas: false
});

runtime.world.input.keyboard.addGuard(inputLayers);

const modelScene = new ModelEditorScene();
await runtime.load({
  scene: modelScene,
  skipLoadingScreen: true,
  maxFps: Infinity
});

const { modelSceneComponent } = await modelScene.ready;

(rightPanel as any).setModelManager(modelSceneComponent.getModelManager());
(rightPanel as any).setSceneManager(modelSceneComponent);
(leftPanel as any).setSceneManager(modelSceneComponent);

const cubeUvSync = new CubeUvSync({
  modelSceneComponent,
  getCanvasManager: () => (leftPanel as any).canvasManager ?? null
});

requestAnimationFrame(function updateLoop() {
  cubeUvSync.update();
  requestAnimationFrame(updateLoop);
});

function triggerLeftPanelResize() {
  (leftPanel as any).onResize?.();
}

leftDock.addEventListener("jolly-resize", triggerLeftPanelResize);
rightDock.addEventListener("jolly-resize", triggerLeftPanelResize);

rightPanel.addEventListener("addcube", (e: any) => {
  cubeUvSync.createCube(e.detail.name);
});
