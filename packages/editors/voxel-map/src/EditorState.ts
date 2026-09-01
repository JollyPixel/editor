// Import Third-party Dependencies
import type { Vector3Like } from "@jolly-pixel/three";
import type { PresencePeer } from "@jolly-pixel/ui";
import type {
  VoxelLayerHookEvent,
  VoxelRotation
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { ObjectKey } from "./features/object-layers/objectArea.ts";

// CONSTANTS
const kMinBrushSize = 1;
const kMaxBrushSize = 8;

export type SidebarTab = "general" | "paint" | "layers";
export type RotationMode = typeof VoxelRotation[keyof typeof VoxelRotation] | "auto";

/**
 * What the layers tree has selected. An object row carries its own layer,
 * so an object selection stays anchored to the layer that holds it.
 */
export type LayerSelection =
  | { kind: "voxel-layer"; name: string; }
  | { kind: "object-layer"; name: string; }
  | { kind: "object"; layerName: string; objectId: string; }
  | null;

/**
 * Resolves the grid cell the camera is aimed at. Registered by the scene,
 * which owns the camera, and read by the UI when it needs a spawn point.
 */
export type ViewFocusProvider = () => Vector3Like;

export interface EditorStateEventMap {
  selectionChange: LayerSelection;
  selectedBlockChange: number;
  brushSizeChange: number;
  rotationModeChange: RotationMode;
  flipYChange: boolean;
  activeSidebarTabChange: SidebarTab;
  gizmoLayerChange: string | null;
  gizmoDraggingChange: boolean;
  layerUpdated: VoxelLayerHookEvent;
  blockRegistryChanged: undefined;
  worldReset: undefined;
  peersChange: readonly PresencePeer[];
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
  #viewFocusProvider: ViewFocusProvider | null = null;
  #peers: readonly PresencePeer[] = [];

  get selection(): LayerSelection {
    return this.#selection;
  }

  /**
   * Name of the selected voxel layer, null under any other selection. The
   * brush paints here, so an object selection must never resolve to a name.
   */
  get selectedVoxelLayer(): string | null {
    return this.#selection?.kind === "voxel-layer"
      ? this.#selection.name
      : null;
  }

  /**
   * Object layer the selection sits in, whether the layer row itself or one
   * of its object rows is selected.
   */
  get activeObjectLayer(): string | null {
    const selection = this.#selection;
    if (selection === null) {
      return null;
    }

    switch (selection.kind) {
      case "object-layer":
        return selection.name;
      case "object":
        return selection.layerName;
      default:
        return null;
    }
  }

  /** Whether the layers tree has an object layer or one of its objects. */
  get isObjectContext(): boolean {
    return this.activeObjectLayer !== null;
  }

  get selectedObject(): ObjectKey | null {
    return this.#selection?.kind === "object"
      ? {
        layerName: this.#selection.layerName,
        objectId: this.#selection.objectId
      }
      : null;
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

  get peers(): readonly PresencePeer[] {
    return this.#peers;
  }

  get viewFocusProvider(): ViewFocusProvider | null {
    return this.#viewFocusProvider;
  }

  set viewFocusProvider(
    provider: ViewFocusProvider | null
  ) {
    this.#viewFocusProvider = provider;
  }

  get viewFocus(): Vector3Like {
    return this.#viewFocusProvider?.() ?? {
      x: 0,
      y: 0,
      z: 0
    };
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
    if (this.#isGizmoDragging === dragging) {
      return;
    }
    this.#isGizmoDragging = dragging;
    this.#dispatch("gizmoDraggingChange", dragging);
  }

  setGizmoLayer(name: string | null): void {
    if (this.#gizmoLayer === name) {
      return;
    }
    this.#gizmoLayer = name;
    this.#dispatch("gizmoLayerChange", name);
  }

  setSelection(
    selection: LayerSelection
  ): void {
    if (selectionKey(this.#selection) === selectionKey(selection)) {
      return;
    }

    this.#selection = selection;
    this.#dispatch("selectionChange", selection);

    if (this.#gizmoLayer !== null) {
      this.#gizmoLayer = null;
      this.#dispatch("gizmoLayerChange", null);
    }
  }

  selectVoxelLayer(
    name: string | null
  ): void {
    this.setSelection(
      name === null ? null : { kind: "voxel-layer", name }
    );
  }

  selectObjectLayer(
    name: string
  ): void {
    this.setSelection({ kind: "object-layer", name });
  }

  selectObject(
    key: ObjectKey
  ): void {
    this.setSelection({
      kind: "object",
      layerName: key.layerName,
      objectId: key.objectId
    });
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

  setPeers(peers: Iterable<PresencePeer>): void {
    this.#peers = [...peers];
    this.#dispatch("peersChange", this.#peers);
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

function selectionKey(
  selection: LayerSelection
): string | null {
  if (selection === null) {
    return null;
  }

  return selection.kind === "object"
    ? `${selection.kind}:${selection.layerName}/${selection.objectId}`
    : `${selection.kind}:${selection.name}`;
}

export const editorState = new EditorState();
