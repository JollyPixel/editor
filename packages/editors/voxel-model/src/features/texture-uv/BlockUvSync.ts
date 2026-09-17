// Import Third-party Dependencies
import {
  DEFAULT_UV_SLOTS,
  type PixelArtCanvas,
  type UVGeometry,
  type UVMapListener,
  type UVRegion,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type GroupManager from "../groups/GroupManager.ts";
import type { ModelSceneComponent } from "../../app/ModelSceneComponent.ts";
import { editorState, type ModelEventMap } from "../../app/state/index.ts";
import type { MirrorAxes } from "../groups/mirrorTransform.ts";

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

const kSlotAxis: Record<UVSlot, keyof MirrorAxes> = {
  right: "x",
  left: "x",
  top: "y",
  bottom: "y",
  front: "z",
  back: "z"
};

const kSlotOpposite: Record<UVSlot, UVSlot> = {
  right: "left",
  left: "right",
  top: "bottom",
  bottom: "top",
  front: "back",
  back: "front"
};

const kDefaultFaceUV: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 1],
  [0, 0],
  [1, 0]
];

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

function flipConfigForAxes(
  axes: MirrorAxes | undefined
): { swap: Set<UVSlot>; flipU: Set<UVSlot>; } {
  const swap = new Set<UVSlot>();
  const flipU = new Set<UVSlot>();
  if (!axes) {
    return { swap, flipU };
  }

  for (const slot of DEFAULT_UV_SLOTS) {
    const ownAxis = kSlotAxis[slot];
    if (axes[ownAxis]) {
      swap.add(slot);
    }

    const otherAxes = (["x", "y", "z"] as const).filter((axis) => axis !== ownAxis);
    if (otherAxes.reduce((flipped, axis) => flipped !== axes[axis], false)) {
      flipU.add(slot);
    }
  }

  return { swap, flipU };
}

export interface BlockUvSyncOptions {
  modelSceneComponent: ModelSceneComponent;
  getCanvasManager(): PixelArtCanvas | null;
}

export default class BlockUvSync {
  #modelSceneComponent: ModelSceneComponent;
  #getCanvasManager: () => PixelArtCanvas | null;
  #uvSyncWired = false;
  #mappedUuids = new Set<string>();

  constructor(options: BlockUvSyncOptions) {
    this.#modelSceneComponent = options.modelSceneComponent;
    this.#getCanvasManager = options.getCanvasManager;

    editorState.modelEvents.on("groupSelected", this.#onGroupSelected);
    editorState.modelEvents.on("groupRemoved", this.#onGroupRemoved);
  }

  public update(): void {
    const canvasManager = this.#getCanvasManager();
    if (!canvasManager) {
      return;
    }

    this.#modelSceneComponent.setCanvasTexture(canvasManager);
    this.#wireUvSyncOnce(canvasManager);
    this.#reconcileBlockUvMappings(canvasManager);
  }

  public createBlock(
    name: string,
    parentId: string | null = null
  ): GroupManager {
    const group = this.#modelSceneComponent.createBlock(name, parentId);

    const canvasManager = this.#getCanvasManager();
    if (canvasManager) {
      canvasManager.uv.create({
        id: blockRegionId(group.getGroupUUID()),
        name,
        color: kBlockUvColor,
        ...kBlockUvSize,
        state: "unfolded"
      });
    }

    return group;
  }

  public removeBlock(uuid: string): void {
    this.#modelSceneComponent.removeBlock(uuid);
  }

  public duplicateBlock(
    sourceUuid: string,
    uuid: string,
    name: string
  ): void {
    const canvasManager = this.#getCanvasManager();
    if (!canvasManager) {
      return;
    }

    const sourceRegion = canvasManager.uv.get(blockRegionId(sourceUuid));
    if (sourceRegion) {
      canvasManager.uv.restore({
        ...sourceRegion.toJSON(),
        id: blockRegionId(uuid),
        name
      });

      return;
    }

    canvasManager.uv.create({
      id: blockRegionId(uuid),
      name,
      color: kBlockUvColor,
      ...kBlockUvSize,
      state: "unfolded"
    });
  }

  public refreshFlipAxes(
    uuid: string
  ): void {
    const canvasManager = this.#getCanvasManager();
    const group = this.#modelSceneComponent.getModelManager().getGroupByUUID(uuid);
    const region = canvasManager?.uv.get(blockRegionId(uuid));
    if (canvasManager && group && region) {
      this.#applyUvRegionToBlock(group, region, canvasManager.textureSize);
    }
  }

  public applyPeerDragPreview(
    payload: { id: string; face: UVSlot | null; geometry: UVGeometry; }
  ): void {
    const region = this.#getCanvasManager()?.uv.get(payload.id);
    if (!region) {
      return;
    }

    const rect = "shape" in payload.geometry ? payload.geometry.rect : payload.geometry;
    this.#reapplyRegion(region.withRect(rect, payload.face ?? undefined));
  }

  #wireUvSyncOnce(
    canvasManager: PixelArtCanvas
  ): void {
    if (this.#uvSyncWired) {
      return;
    }
    this.#uvSyncWired = true;

    canvasManager.uv.on("selection-changed", this.#onUvSelectionChanged);
    canvasManager.uv.on("region-moved", this.#onUvRegionChanged);
    canvasManager.uv.on("region-state-changed", this.#onUvRegionStateChanged);
    canvasManager.uv.on("region-dragging", this.#onUvRegionDragging);
  }

  #reconcileBlockUvMappings(
    canvasManager: PixelArtCanvas
  ): void {
    for (const group of this.#modelSceneComponent.getModelManager().getGroups()) {
      const uuid = group.getGroupUUID();
      if (this.#mappedUuids.has(uuid)) {
        continue;
      }

      const region = canvasManager.uv.get(blockRegionId(uuid));
      if (region) {
        this.#applyUvRegionToBlock(group, region, canvasManager.textureSize);
        this.#mappedUuids.add(uuid);
      }
    }
  }

  readonly #onGroupRemoved: ModelEventMap["groupRemoved"] = (
    { uuid }
  ) => {
    this.#mappedUuids.delete(uuid);

    const canvasManager = this.#getCanvasManager();
    canvasManager?.uv.delete(blockRegionId(uuid));
  };

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
    editorState.modelEvents.emit("groupSelected", { group });
  };

  readonly #onUvRegionChanged: UVMapListener<"region-moved"> = (
    { region }
  ): void => {
    this.#reapplyRegion(region);
  };

  readonly #onUvRegionStateChanged: UVMapListener<"region-state-changed"> = (
    { region }
  ): void => {
    this.#reapplyRegion(region);
  };

  readonly #onUvRegionDragging: UVMapListener<"region-dragging"> = (
    { id, face, rect }
  ): void => {
    const region = this.#getCanvasManager()?.uv.get(id);
    if (!region) {
      return;
    }

    this.#reapplyRegion(region.withRect(rect, face ?? undefined));
  };

  #reapplyRegion(
    region: UVRegion
  ): void {
    const uuid = blockUuidFromRegion(region.id);
    if (uuid === null) {
      return;
    }

    const group = this.#modelSceneComponent.getModelManager().getGroupByUUID(uuid);
    const canvasManager = this.#getCanvasManager();
    if (!group || !canvasManager) {
      return;
    }

    this.#applyUvRegionToBlock(group, region, canvasManager.textureSize);
    this.#mappedUuids.add(uuid);
  }

  readonly #onGroupSelected: ModelEventMap["groupSelected"] = (
    { group }
  ) => {
    const canvasManager = this.#getCanvasManager();
    if (!canvasManager) {
      return;
    }

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
    const { swap, flipU } = flipConfigForAxes(
      this.#modelSceneComponent.getModelManager().getFlipAxes(group.getGroupUUID())
    );

    for (const slot of DEFAULT_UV_SLOTS) {
      const geometry = region.geometryFor(swap.has(slot) ? kSlotOpposite[slot] : slot);
      if ("shape" in geometry) {
        continue;
      }

      const u0 = geometry.x / textureSize.x;
      const u1 = (geometry.x + geometry.width) / textureSize.x;
      const vTop = 1 - (geometry.y / textureSize.y);
      const vBottom = 1 - ((geometry.y + geometry.height) / textureSize.y);
      const [start, end] = kBoxFaceVertexRanges[slot];
      const mirrorU = flipU.has(slot);

      for (let i = start; i < end; i++) {
        const [rawU, baseV] = kDefaultFaceUV[i - start];
        const baseU = mirrorU ? 1 - rawU : rawU;
        uv.setXY(i, u0 + (baseU * (u1 - u0)), vBottom + (baseV * (vTop - vBottom)));
      }
    }
    uv.needsUpdate = true;
  }
}
