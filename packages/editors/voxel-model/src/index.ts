// Import Third-party Dependencies
import { Runtime } from "@jolly-pixel/runtime";
import { inputLayers } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "./app/state/index.ts";
import { ModelEditorScene } from "./app/ModelEditorScene.ts";
import { EditorSession } from "./boot/EditorSession.ts";
import { LeftPanel } from "./app/LeftPanel.ts";
import { RightPanel } from "./app/RightPanel/RightPanel.ts";
import BlockUvSync from "./features/texture-uv/BlockUvSync.ts";

const leftPanel = document.querySelector("jolly-model-editor-left-panel") as LeftPanel;
const rightPanel = document.querySelector("jolly-model-editor-right-panel") as RightPanel;
const leftDock = document.querySelector("jolly-dock[side='left']") as HTMLElement;

const session = await EditorSession.open();
leftPanel.setTextureRoom(session.textureRoom);

const runtime = await Runtime.create("#three-renderer canvas", {
  focusCanvas: false,
  viewHelper: true
});

runtime.world.input.keyboard.addGuard(inputLayers);
leftPanel.setCanvasHoverHandler((hovering) => {
  runtime.world.input.keyboard.enabled = !hovering;
});

const modelScene = new ModelEditorScene({
  room: session.modelRoom,
  folderRoom: session.folderRoom,
  identity: session.identity
});
await runtime.load({
  scene: modelScene,
  skipLoadingScreen: true,
  maxFps: Infinity
});

const { modelSceneComponent } = await modelScene.ready;

rightPanel.setModelManager(modelSceneComponent.getModelManager());
rightPanel.setFolderManager(modelSceneComponent.getFolderManager());
rightPanel.setSceneManager(modelSceneComponent);
rightPanel.setPresence(editorState.presence);

const blockUvSync = new BlockUvSync({
  modelSceneComponent,
  getCanvasManager: () => leftPanel.canvasManager
});

leftPanel.setPeerUvDraggingHandler(
  (payload) => blockUvSync.applyPeerDragPreview(payload)
);

requestAnimationFrame(function updateLoop() {
  blockUvSync.update();
  requestAnimationFrame(updateLoop);
});

let leftPanelResizeFrame: number | null = null;

function scheduleLeftPanelResize(): void {
  if (leftPanelResizeFrame !== null) {
    return;
  }

  leftPanelResizeFrame = requestAnimationFrame(() => {
    leftPanelResizeFrame = null;
    leftPanel.onResize();
  });
}

leftDock.addEventListener("jolly-resize", scheduleLeftPanelResize);
leftDock.addEventListener("jolly-resize-end", scheduleLeftPanelResize);

editorState.modelEvents.on("addblock", ({ name, parentId }) => {
  blockUvSync.createBlock(name, parentId ?? null);
});

editorState.modelEvents.on("duplicateblock", ({ sourceUuid, uuid, name }) => {
  blockUvSync.duplicateBlock(sourceUuid, uuid, name);
});

editorState.modelEvents.on("groupMirrored", ({ uuid }) => {
  blockUvSync.refreshFlipAxes(uuid);
});

const unwatchDefaultBlockSeed = editorState.modelEvents.watch(
  "modelSnapshotApplied",
  ({ nodes }) => {
    unwatchDefaultBlockSeed();
    if (nodes.length === 0) {
      blockUvSync.createBlock("Block");
    }
  }
);

editorState.modelEvents.on("deleteblock", ({ uuids }) => {
  for (const uuid of uuids) {
    blockUvSync.removeBlock(uuid);
  }
});
