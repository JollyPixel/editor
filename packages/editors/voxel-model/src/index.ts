// Import Third-party Dependencies
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import "@jolly-pixel/ui";
import {
  DEFAULT_UV_SLOTS,
  type UVMapListener,
  type UVRegion,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { ModelEditorScene } from "./three/ModelEditorScene.ts";
import type GroupManager from "./three/GroupManager.ts";
import "./components/LeftPanel.ts";
import "./components/RightPanel.ts";

// CONSTANTS
const kCubeUvSize = { width: 16, height: 16 };
const kCubeUvColor = "#4488ff";
const kCubeRegionPrefix = "cube-";

function cubeRegionId(
  uuid: string
): string {
  return `${kCubeRegionPrefix}${uuid}`;
}

function cubeUuidFromRegion(
  id: string
): string | null {
  return id.startsWith(kCubeRegionPrefix) ? id.slice(kCubeRegionPrefix.length) : null;
}

const kBoxFaceVertexRanges: Record<UVSlot, readonly [number, number]> = {
  right: [0, 4],
  left: [4, 8],
  top: [8, 12],
  bottom: [12, 16],
  front: [16, 20],
  back: [20, 24]
};

function applyUvRegionToCube(
  group: GroupManager,
  region: UVRegion,
  textureSize: { x: number; y: number; }
): void {
  const uv = group.getMesh().geometry.attributes.uv;

  for (const slot of DEFAULT_UV_SLOTS) {
    const geometry = region.geometryFor(slot);
    if ("shape" in geometry) {
      continue;
    }

    const u0 = geometry.x / textureSize.x;
    const u1 = (geometry.x + geometry.width) / textureSize.x;
    const vTop = 1 - (geometry.y / textureSize.y);
    const vBottom = 1 - ((geometry.y + geometry.height) / textureSize.y);
    const [start, end] = kBoxFaceVertexRanges[slot];

    for (let i = start; i < end; i++) {
      uv.setXY(i, u0 + (uv.getX(i) * (u1 - u0)), vBottom + (uv.getY(i) * (vTop - vBottom)));
    }
  }
  uv.needsUpdate = true;
}

const leftPanel = document.querySelector("jolly-model-editor-left-panel") as HTMLElement;
const rightPanel = document.querySelector("jolly-model-editor-right-panel") as HTMLElement;
const leftDock = document.querySelector("jolly-dock[side='left']") as HTMLElement;
const rightDock = document.querySelector("jolly-dock[side='right']") as HTMLElement;

const runtime = await Runtime.create("#threeRenderer canvas", {
  focusCanvas: false
});

const modelScene = new ModelEditorScene();
await loadRuntime(runtime, {
  scene: modelScene,
  skipLoadingScreen: true,
  maxFps: Infinity
});

const { modelSceneComponent } = await modelScene.ready;

(rightPanel as any).setModelManager(modelSceneComponent.getModelManager());
(rightPanel as any).setSceneManager(modelSceneComponent);

let uvSelectionSyncWired = false;

function onUvSelectionChanged(
  { selectedRegionId }: Parameters<UVMapListener<"selection-changed">>[0]
): void {
  const modelManager = modelSceneComponent.getModelManager();
  const uuid = selectedRegionId === null ? null : cubeUuidFromRegion(selectedRegionId);
  const group = uuid === null ? null : (modelManager.getGroupByUUID(uuid) ?? null);

  if (modelManager.getSelectedGroup() === group) {
    return;
  }

  modelManager.selectGroup(group);
  document.dispatchEvent(new CustomEvent("groupSelected", { detail: { group } }));
}

function wireUvSelectionSyncOnce(): void {
  if (uvSelectionSyncWired) {
    return;
  }

  const canvasManager = (leftPanel as any).canvasManager;
  if (!canvasManager) {
    return;
  }
  uvSelectionSyncWired = true;

  canvasManager.uv.on("selection-changed", onUvSelectionChanged);
}

document.addEventListener("groupSelected", (e: any) => {
  const canvasManager = (leftPanel as any).canvasManager;
  if (!canvasManager) {
    return;
  }

  const group = e.detail.group as GroupManager | null;
  const targetId = group ? cubeRegionId(group.getGroupUUID()) : null;
  if (canvasManager.uv.selectedRegionId === targetId) {
    return;
  }

  canvasManager.uv.select(targetId);
});

function updateCanvasTexture() {
  const canvasManager = (leftPanel as any).canvasManager;
  if (canvasManager) {
    modelSceneComponent.setCanvasTexture(canvasManager);
    wireUvSelectionSyncOnce();
  }
}

requestAnimationFrame(function updateLoop() {
  updateCanvasTexture();
  requestAnimationFrame(updateLoop);
});

function triggerLeftPanelResize() {
  (leftPanel as any).onResize?.();
}

leftDock.addEventListener("jolly-resize", triggerLeftPanelResize);
rightDock.addEventListener("jolly-resize", triggerLeftPanelResize);

rightPanel.addEventListener("addcube", (e: any) => {
  const { name } = e.detail;
  const group = modelSceneComponent.createCube(name);

  const canvasManager = (leftPanel as any).canvasManager;
  if (canvasManager) {
    const region = canvasManager.uv.create({
      id: cubeRegionId(group.getGroupUUID()),
      name,
      color: kCubeUvColor,
      ...kCubeUvSize,
      state: "unfolded"
    });
    applyUvRegionToCube(group, region, canvasManager.textureSize);
  }
});
