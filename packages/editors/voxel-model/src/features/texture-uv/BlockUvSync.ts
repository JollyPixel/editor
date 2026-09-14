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
const kBlockUvSize = { width: 16, height: 16 };
const kBlockUvColor = "#4488ff";
const kBlockRegionPrefix = "block-";

const kBoxFaceVertexRanges: Record<UVSlot, readonly [number, number]> = {
  right: [0, 4],
  left: [4, 8],
  top: [8, 12],
  bottom: [12, 16],
  front: [16, 20],
  back: [20, 24]
};

function blockRegionId(
  uuid: string
): string {
  return `${kBlockRegionPrefix}${uuid}`;
}

function blockUuidFromRegion(
  id: string
): string | null {
  return id.startsWith(kBlockRegionPrefix) ? id.slice(kBlockRegionPrefix.length) : null;
}

export interface BlockUvSyncOptions {
  modelSceneComponent: ModelSceneComponent;
  getCanvasManager(): PixelArtCanvas | null;
}

export default class BlockUvSync {
  #modelSceneComponent: ModelSceneComponent;
  #getCanvasManager: () => PixelArtCanvas | null;
  #uvSelectionSyncWired = false;

  constructor(options: BlockUvSyncOptions) {
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

  public createBlock(
    name: string,
    parentId: string | null = null
  ): GroupManager {
    const group = this.#modelSceneComponent.createBlock(name, parentId);

    const canvasManager = this.#getCanvasManager();
    if (canvasManager) {
      const region = canvasManager.uv.create({
        id: blockRegionId(group.getGroupUUID()),
        name,
        color: kBlockUvColor,
        ...kBlockUvSize,
        state: "unfolded"
      });
      this.#applyUvRegionToBlock(group, region, canvasManager.textureSize);
    }

    return group;
  }

  public removeBlock(uuid: string): void {
    this.#modelSceneComponent.removeBlock(uuid);

    const canvasManager = this.#getCanvasManager();
    canvasManager?.uv.delete(blockRegionId(uuid));
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
    const uuid = selectedRegionId === null ? null : blockUuidFromRegion(selectedRegionId);
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
    const targetId = group ? blockRegionId(group.getGroupUUID()) : null;
    if (canvasManager.uv.selectedRegionId === targetId) {
      return;
    }

    canvasManager.uv.select(targetId);
  };

  #applyUvRegionToBlock(
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
