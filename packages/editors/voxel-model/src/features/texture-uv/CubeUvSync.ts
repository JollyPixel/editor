// Import Third-party Dependencies
import {
  DEFAULT_UV_SLOTS,
  type PixelArtCanvas,
  type UVMapListener,
  type UVRegion,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type GroupManager from "../groups/GroupManager.ts";
import type { ModelSceneComponent } from "../../app/ModelSceneComponent.ts";

// CONSTANTS
const kCubeUvSize = { width: 16, height: 16 };
const kCubeUvColor = "#4488ff";
const kCubeRegionPrefix = "cube-";

const kBoxFaceVertexRanges: Record<UVSlot, readonly [number, number]> = {
  right: [0, 4],
  left: [4, 8],
  top: [8, 12],
  bottom: [12, 16],
  front: [16, 20],
  back: [20, 24]
};

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

export interface CubeUvSyncOptions {
  modelSceneComponent: ModelSceneComponent;
  getCanvasManager(): PixelArtCanvas | null;
}

export default class CubeUvSync {
  #modelSceneComponent: ModelSceneComponent;
  #getCanvasManager: () => PixelArtCanvas | null;
  #uvSelectionSyncWired = false;

  constructor(options: CubeUvSyncOptions) {
    this.#modelSceneComponent = options.modelSceneComponent;
    this.#getCanvasManager = options.getCanvasManager;

    document.addEventListener("groupSelected", this.#onGroupSelected);
  }

  public update(): void {
    const canvasManager = this.#getCanvasManager();
    if (!canvasManager) {
      return;
    }

    this.#modelSceneComponent.setCanvasTexture(canvasManager);
    this.#wireUvSelectionSyncOnce(canvasManager);
  }

  public createCube(name: string): GroupManager {
    const group = this.#modelSceneComponent.createCube(name);

    const canvasManager = this.#getCanvasManager();
    if (canvasManager) {
      const region = canvasManager.uv.create({
        id: cubeRegionId(group.getGroupUUID()),
        name,
        color: kCubeUvColor,
        ...kCubeUvSize,
        state: "unfolded"
      });
      this.#applyUvRegionToCube(group, region, canvasManager.textureSize);
    }

    return group;
  }

  #wireUvSelectionSyncOnce(
    canvasManager: PixelArtCanvas
  ): void {
    if (this.#uvSelectionSyncWired) {
      return;
    }
    this.#uvSelectionSyncWired = true;

    canvasManager.uv.on("selection-changed", this.#onUvSelectionChanged);
  }

  readonly #onUvSelectionChanged = (
    { selectedRegionId }: Parameters<UVMapListener<"selection-changed">>[0]
  ): void => {
    const modelManager = this.#modelSceneComponent.getModelManager();
    const uuid = selectedRegionId === null ? null : cubeUuidFromRegion(selectedRegionId);
    const group = uuid === null ? null : (modelManager.getGroupByUUID(uuid) ?? null);

    if (modelManager.getSelectedGroup() === group) {
      return;
    }

    modelManager.selectGroup(group);
    document.dispatchEvent(new CustomEvent("groupSelected", { detail: { group } }));
  };

  readonly #onGroupSelected = (
    event: Event
  ): void => {
    const canvasManager = this.#getCanvasManager();
    if (!canvasManager) {
      return;
    }

    const { group } = (event as CustomEvent<{ group: GroupManager | null; }>).detail;
    const targetId = group ? cubeRegionId(group.getGroupUUID()) : null;
    if (canvasManager.uv.selectedRegionId === targetId) {
      return;
    }

    canvasManager.uv.select(targetId);
  };

  #applyUvRegionToCube(
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
}
