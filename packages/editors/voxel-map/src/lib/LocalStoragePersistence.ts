// Import Third-party Dependencies
import type { VoxelRenderer, VoxelWorldJSON } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { EditorState } from "../EditorState.ts";

// CONSTANTS
const kStorageKey = "jolly-pixel-voxel-map-world";
const kDebounceMs = 1500;

export class LocalStoragePersistence {
  static hasSavedData(): boolean {
    return localStorage.getItem(kStorageKey) !== null;
  }

  static load(): VoxelWorldJSON | null {
    const raw = localStorage.getItem(kStorageKey);
    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as VoxelWorldJSON;
    }
    catch {
      return null;
    }
  }

  static clear(): void {
    localStorage.removeItem(kStorageKey);
  }

  #vr: VoxelRenderer;
  #editorState: EditorState;
  #debounceTimer = -1;

  constructor(
    vr: VoxelRenderer,
    editorState: EditorState
  ) {
    this.#vr = vr;
    this.#editorState = editorState;
  }

  start(): void {
    this.#editorState.addEventListener("layerUpdated", () => {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = setTimeout(
        () => this.#save(),
        kDebounceMs
      ) as unknown as number;
    });

    document.addEventListener("world-loaded", () => this.#save());
  }

  #save(): void {
    const json = this.#vr.save();
    localStorage.setItem(kStorageKey, JSON.stringify(json));
  }
}
