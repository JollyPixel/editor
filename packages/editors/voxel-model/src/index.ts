// Import Third-party Dependencies
import { Runtime } from "@jolly-pixel/runtime";
import { inputLayers } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "./app/state/index.ts";
import { ModelEditorScene } from "./app/ModelEditorScene.ts";
import { EditorSession } from "./boot/EditorSession.ts";
import "./app/LeftPanel.ts";
import "./app/RightPanel/RightPanel.ts";
import BlockUvSync from "./features/texture-uv/BlockUvSync.ts";

const leftPanel = document.querySelector("jolly-model-editor-left-panel") as HTMLElement;
const rightPanel = document.querySelector("jolly-model-editor-right-panel") as HTMLElement;
const leftDock = document.querySelector("jolly-dock[side='left']") as HTMLElement;
const rightDock = document.querySelector("jolly-dock[side='right']") as HTMLElement;

const session = await EditorSession.open();
(leftPanel as any).setTextureRoom(session.textureRoom);

const runtime = await Runtime.create("#threeRenderer canvas", {
  focusCanvas: false
});

runtime.world.input.keyboard.addGuard(inputLayers);

const modelScene = new ModelEditorScene({
  room: session.modelRoom,
  identity: session.identity
});
await runtime.load({
  scene: modelScene,
  skipLoadingScreen: true,
  maxFps: Infinity
});

const { modelSceneComponent } = await modelScene.ready;

(rightPanel as any).setModelManager(modelSceneComponent.getModelManager());
(rightPanel as any).setSceneManager(modelSceneComponent);
(rightPanel as any).setPresence(editorState.presence);
(leftPanel as any).setSceneManager(modelSceneComponent);

const blockUvSync = new BlockUvSync({
  modelSceneComponent,
  getCanvasManager: () => (leftPanel as any).canvasManager ?? null
});

requestAnimationFrame(function updateLoop() {
  blockUvSync.update();
  requestAnimationFrame(updateLoop);
});

function triggerLeftPanelResize() {
  (leftPanel as any).onResize?.();
}

leftDock.addEventListener("jolly-resize", triggerLeftPanelResize);
rightDock.addEventListener("jolly-resize", triggerLeftPanelResize);

rightPanel.addEventListener("addblock", (e: any) => {
  blockUvSync.createBlock(e.detail.name, e.detail.parentId ?? null);
});

rightPanel.addEventListener("deleteblock", (e: any) => {
  for (const uuid of e.detail.uuids as string[]) {
    blockUvSync.removeBlock(uuid);
  }
});
