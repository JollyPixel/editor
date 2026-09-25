// Import Third-party Dependencies
import {
  LocalStorageAdapter,
  LogQueue,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { BrushStore } from "./BrushStore.ts";
import { LayerVisibilityStore } from "./LayerVisibilityStore.ts";
import { PresenceStore } from "./PresenceStore.ts";
import { SelectionStore } from "./SelectionStore.ts";
import { TilesetStore } from "./TilesetStore.ts";
import { ViewStore } from "./ViewStore.ts";

export interface EditorStateOptions {
  storage?: StorageAdapter;
}

export class EditorState {
  readonly selection = new SelectionStore();
  readonly brush = new BrushStore();
  readonly presence = new PresenceStore();
  readonly tilesets = new TilesetStore();
  readonly layerVisibility = new LayerVisibilityStore();
  readonly log = new LogQueue();
  readonly view: ViewStore;

  constructor(
    options: EditorStateOptions = {}
  ) {
    const { storage = new LocalStorageAdapter() } = options;
    this.view = new ViewStore(storage);
  }
}
