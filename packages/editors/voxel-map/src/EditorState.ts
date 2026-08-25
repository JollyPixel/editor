// Import Third-party Dependencies
import type {
  VoxelLayerHookEvent,
  VoxelRotation
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kMinBrushSize = 1;
const kMaxBrushSize = 8;

export type SidebarTab = "general" | "paint" | "layers";
export type RotationMode = typeof VoxelRotation[keyof typeof VoxelRotation] | "auto";
export type LayerSelection = {
  name: string;
  type: "voxel" | "object";
} | null;

export interface EditorStateEventMap {
  selectionChange: LayerSelection;
  selectedBlockChange: number;
  brushSizeChange: number;
  rotationModeChange: RotationMode;
  flipYChange: boolean;
  activeSidebarTabChange: SidebarTab;
  gizmoLayerChange: string | null;
  layerUpdated: VoxelLayerHookEvent;
  blockRegistryChanged: undefined;
  worldReset: undefined;
}

export class EditorState {
  #events = new EventTarget();
  #selection: LayerSelection = null;
  #selectedBlockId = 1;
  #brushSize = 1;
  #rotationMode: RotationMode = "auto";
  #flipY = false;
  #activeSidebarTab: SidebarTab = "general";
  #isGizmoDragging = false;
  #gizmoLayer: string | null = null;

  get selection(): LayerSelection {
    return this.#selection;
  }

  get selectedLayer(): string | null {
    return this.#selection?.name ?? null;
  }

  get selectedLayerType(): "voxel" | "object" | null {
    return this.#selection?.type ?? null;
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

  get flipY(): boolean {
    return this.#flipY;
  }

  get activeSidebarTab(): SidebarTab {
    return this.#activeSidebarTab;
  }

  get isGizmoDragging(): boolean {
    return this.#isGizmoDragging;
  }

  get gizmoLayer(): string | null {
    return this.#gizmoLayer;
  }

  on<K extends keyof EditorStateEventMap>(
    type: K,
    listener: (value: EditorStateEventMap[K]) => void
  ): () => void {
    function eventListener(event: Event): void {
      listener((event as CustomEvent<EditorStateEventMap[K]>).detail);
    }
    this.#events.addEventListener(type, eventListener);

    return () => this.#events.removeEventListener(type, eventListener);
  }

  setGizmoDragging(dragging: boolean): void {
    this.#isGizmoDragging = dragging;
  }

  setGizmoLayer(name: string | null): void {
    if (this.#gizmoLayer === name) {
      return;
    }
    this.#gizmoLayer = name;
    this.#dispatch("gizmoLayerChange", name);
  }

  setSelectedLayer(
    name: string | null,
    type: "voxel" | "object" = "voxel"
  ): void {
    const next = name === null ? null : { name, type };
    if (
      this.#selection?.name === next?.name &&
      this.#selection?.type === next?.type
    ) {
      return;
    }

    this.#selection = next;
    this.#dispatch("selectionChange", next);

    if (this.#gizmoLayer !== null) {
      this.#gizmoLayer = null;
      this.#dispatch("gizmoLayerChange", null);
    }
  }

  setSelectedBlock(id: number): void {
    if (this.#selectedBlockId === id) {
      return;
    }
    this.#selectedBlockId = id;
    this.#dispatch("selectedBlockChange", id);
  }

  setBrushSize(delta: number): void {
    const next = Math.max(
      kMinBrushSize,
      Math.min(kMaxBrushSize, this.#brushSize + delta)
    );
    if (this.#brushSize === next) {
      return;
    }
    this.#brushSize = next;
    this.#dispatch("brushSizeChange", next);
  }

  setBrushSizeAbsolute(size: number): void {
    this.setBrushSize(size - this.#brushSize);
  }

  setRotationMode(mode: RotationMode): void {
    if (this.#rotationMode === mode) {
      return;
    }
    this.#rotationMode = mode;
    this.#dispatch("rotationModeChange", mode);
  }

  setFlipY(value: boolean): void {
    if (this.#flipY === value) {
      return;
    }
    this.#flipY = value;
    this.#dispatch("flipYChange", value);
  }

  setActiveSidebarTab(tab: SidebarTab): void {
    if (this.#activeSidebarTab === tab) {
      return;
    }
    this.#activeSidebarTab = tab;
    this.#dispatch("activeSidebarTabChange", tab);
  }

  dispatchLayerUpdated(event: VoxelLayerHookEvent): void {
    this.#dispatch("layerUpdated", event);
  }

  dispatchBlockRegistryChanged(): void {
    this.#dispatch("blockRegistryChanged", undefined);
  }

  dispatchWorldReset(): void {
    this.#dispatch("worldReset", undefined);
  }

  #dispatch<K extends keyof EditorStateEventMap>(
    type: K,
    value: EditorStateEventMap[K]
  ): void {
    this.#events.dispatchEvent(new CustomEvent(type, { detail: value }));
  }
}

export const editorState = new EditorState();
