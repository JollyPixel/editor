// Import Third-party Dependencies
import type {
  VoxelRotation,
  VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kMinBrushSize = 1;
const kMaxBrushSize = 8;

export type SidebarTab = "general" | "paint" | "layers";
export type RotationMode = typeof VoxelRotation[keyof typeof VoxelRotation] | "auto";

export class EditorState extends EventTarget {
  #selectedLayer: string | null = null;
  #selectedLayerType: "voxel" | "object" | null = null;
  #selectedBlockId: number = 1;
  #brushSize: number = 1;
  #rotationMode: RotationMode = "auto";
  #activeSidebarTab: SidebarTab = "general";
  #isGizmoDragging = false;
  #gizmoLayer: string | null = null;

  get selectedLayer(): string | null {
    return this.#selectedLayer;
  }

  get selectedLayerType(): "voxel" | "object" | null {
    return this.#selectedLayerType;
  }

  get selectedBlockId(): number {
    return this.#selectedBlockId;
  }

  get brushSize(): number {
    return this.#brushSize;
  }

  get rotationMode(): RotationMode {
    return this.#rotationMode;
  }

  get activeSidebarTab(): SidebarTab {
    return this.#activeSidebarTab;
  }

  get isGizmoDragging(): boolean {
    return this.#isGizmoDragging;
  }

  setGizmoDragging(dragging: boolean): void {
    this.#isGizmoDragging = dragging;
  }

  get gizmoLayer(): string | null {
    return this.#gizmoLayer;
  }

  setGizmoLayer(
    name: string | null
  ): void {
    if (this.#gizmoLayer === name) {
      return;
    }
    this.#gizmoLayer = name;
    this.dispatchEvent(
      new CustomEvent("gizmoLayerChange", { detail: name })
    );
    this.dispatchEvent(new CustomEvent("change"));
  }

  setSelectedLayer(
    name: string | null,
    type: "voxel" | "object" = "voxel"
  ): void {
    if (this.#selectedLayer === name) {
      return;
    }
    this.#selectedLayer = name;
    const newType = name === null ? null : type;
    const typeChanged = this.#selectedLayerType !== newType;
    this.#selectedLayerType = newType;

    this.dispatchEvent(
      new CustomEvent("selectedLayerChange", { detail: name })
    );
    if (typeChanged) {
      this.dispatchEvent(
        new CustomEvent("selectedLayerTypeChange", { detail: newType })
      );
    }
    // Deactivate the gizmo whenever the active layer changes.
    if (this.#gizmoLayer !== null) {
      this.#gizmoLayer = null;
      this.dispatchEvent(
        new CustomEvent("gizmoLayerChange", { detail: null })
      );
    }
    this.dispatchEvent(new CustomEvent("change"));
  }

  setSelectedBlock(
    id: number
  ): void {
    if (this.#selectedBlockId === id) {
      return;
    }
    this.#selectedBlockId = id;
    this.dispatchEvent(
      new CustomEvent("selectedBlockChange", { detail: id })
    );
    this.dispatchEvent(new CustomEvent("change"));
  }

  setBrushSize(
    delta: number
  ): void {
    const next = Math.max(
      kMinBrushSize,
      Math.min(kMaxBrushSize, this.#brushSize + delta)
    );
    if (this.#brushSize === next) {
      return;
    }
    this.#brushSize = next;
    this.dispatchEvent(
      new CustomEvent("brushSizeChange", { detail: next })
    );
    this.dispatchEvent(new CustomEvent("change"));
  }

  setBrushSizeAbsolute(
    size: number
  ): void {
    this.setBrushSize(
      size - this.#brushSize
    );
  }

  setRotationMode(
    mode: RotationMode
  ): void {
    if (this.#rotationMode === mode) {
      return;
    }
    this.#rotationMode = mode;
    this.dispatchEvent(
      new CustomEvent("rotationModeChange", { detail: mode })
    );
    this.dispatchEvent(new CustomEvent("change"));
  }

  setActiveSidebarTab(
    tab: SidebarTab
  ): void {
    if (this.#activeSidebarTab === tab) {
      return;
    }
    this.#activeSidebarTab = tab;
    this.dispatchEvent(
      new CustomEvent("activeSidebarTabChange", { detail: tab })
    );
    this.dispatchEvent(new CustomEvent("change"));
  }

  dispatchLayerUpdated(
    evt: VoxelLayerHookEvent
  ): void {
    this.dispatchEvent(
      new CustomEvent("layerUpdated", { detail: evt })
    );
  }

  dispatchBlockRegistryChanged(): void {
    this.dispatchEvent(new CustomEvent("blockRegistryChanged"));
  }
}

export const editorState = new EditorState();
