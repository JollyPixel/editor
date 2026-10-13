// Import Third-party Dependencies
import {
  LocalStorageAdapter,
  LogQueue,
  type StorageAdapter
} from "@jolly-pixel/ui";
import { KeyBindingSettings } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import { BlockSelection } from "./BlockSelection.ts";
import { BrushStore } from "./BrushStore.ts";
import { KeyboardLayoutStore } from "./KeyboardLayoutStore.ts";
import { PointerCapture } from "./PointerCapture.ts";
import { PresenceStore } from "./PresenceStore.ts";
import { SelectionStore } from "./SelectionStore.ts";
import { ToolStore } from "./ToolStore.ts";
import { UvSyncStore } from "./UvSyncStore.ts";
import { ViewStore } from "./ViewStore.ts";

export interface EditorStateOptions {
  storage?: StorageAdapter;
}

export class EditorState {
  readonly selection = new SelectionStore();
  readonly block = new BlockSelection();
  readonly tool = new ToolStore();
  readonly presence = new PresenceStore();
  readonly pointer = new PointerCapture();
  readonly log = new LogQueue();
  readonly keyboardLayout = new KeyboardLayoutStore();
  readonly view: ViewStore;
  readonly brush: BrushStore;
  readonly uvSync: UvSyncStore;
  readonly pixelArtKeyBindings: KeyBindingSettings;

  constructor(
    options: EditorStateOptions = {}
  ) {
    const {
      storage = new LocalStorageAdapter()
    } = options;

    this.view = new ViewStore(storage);
    this.brush = new BrushStore(storage);
    this.uvSync = new UvSyncStore(storage);
    this.pixelArtKeyBindings = new KeyBindingSettings({
      storage,
      onDropped: (message) => this.log.push(message)
    });
  }
}
