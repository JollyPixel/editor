// Import Third-party Dependencies
import {
  LocalStorageAdapter,
  LogQueue,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { BlockSelection } from "./BlockSelection.ts";
import { KeyboardLayoutStore } from "./KeyboardLayoutStore.ts";
import { PointerCapture } from "./PointerCapture.ts";
import { PresenceStore } from "./PresenceStore.ts";
import { SelectionStore } from "./SelectionStore.ts";
import { ViewStore } from "./ViewStore.ts";

export interface EditorStateOptions {
  storage?: StorageAdapter;
}

export class EditorState {
  readonly selection = new SelectionStore();
  readonly block = new BlockSelection();
  readonly presence = new PresenceStore();
  readonly pointer = new PointerCapture();
  readonly log = new LogQueue();
  readonly keyboardLayout = new KeyboardLayoutStore();
  readonly view: ViewStore;

  constructor(
    options: EditorStateOptions = {}
  ) {
    const {
      storage = new LocalStorageAdapter()
    } = options;

    this.view = new ViewStore(storage);
  }
}
