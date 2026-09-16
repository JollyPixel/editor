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

const session = await EditorSession.open();
(leftPanel as any).setTextureRoom(session.textureRoom);

const runtime = await Runtime.create("#three-renderer canvas", {
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

const blockUvSync = new BlockUvSync({
  modelSceneComponent,
  getCanvasManager: () => (leftPanel as any).canvasManager ?? null
});

(leftPanel as any).setPeerUvDraggingHandler(
  (payload: any) => blockUvSync.applyPeerDragPreview(payload)
);

requestAnimationFrame(function updateLoop() {
  blockUvSync.update();
  requestAnimationFrame(updateLoop);
});

/*
 * The left dock's own drag fires "jolly-resize" on every pointermove tick,
 * unthrottled; each tick otherwise forces a synchronous layout read and a
 * full canvas repaint in the pixel-draw panel, which is what produced the
 * lag and wave artifact while dragging. Coalescing to one call per animation
 * frame matches how ThreeRenderer already throttles its own resize.
 */
let leftPanelResizeFrame: number | null = null;

function scheduleLeftPanelResize(): void {
  if (leftPanelResizeFrame !== null) {
    return;
  }

  leftPanelResizeFrame = requestAnimationFrame(() => {
    leftPanelResizeFrame = null;
    (leftPanel as any).onResize?.();
  });
}

leftDock.addEventListener("jolly-resize", scheduleLeftPanelResize);
leftDock.addEventListener("jolly-resize-end", scheduleLeftPanelResize);

rightPanel.addEventListener("addblock", (e: any) => {
  blockUvSync.createBlock(e.detail.name, e.detail.parentId ?? null);
});

rightPanel.addEventListener("deleteblock", (e: any) => {
  for (const uuid of e.detail.uuids as string[]) {
    blockUvSync.removeBlock(uuid);
  }
});
