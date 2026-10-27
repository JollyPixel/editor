// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  emitContainerEvent,
  type ContainerEventMap
} from "../events.ts";
import type { Folder } from "../folder/Folder.ts";
import { FolderReorder } from "../folder/FolderReorder.ts";
import { NamespacedStore } from "../../storage/NamespacedStore.ts";
import type { StorageAdapter } from "../../storage/StorageAdapter.ts";
import {
  deriveKey,
  resolveOrder
} from "../../storage/keys.ts";

interface FolderEntry {
  folder: Folder;
  key: string;
}

export interface FolderListOptions {
  content(): HTMLElement;
  contentSlot(): HTMLSlotElement;
  namespace(): string;
  reorderable(): boolean;
  storage(): StorageAdapter;
  announce(message: string): void;
  toggled(folder: string, open: boolean): void;
  discovered(): void;
}

export class FolderListController {
  readonly #options: FolderListOptions;
  readonly #store: NamespacedStore;
  readonly #reorder: FolderReorder;
  #entries: FolderEntry[] = [];

  constructor(
    host: ReactiveControllerHost,
    options: FolderListOptions
  ) {
    this.#options = options;
    this.#store = new NamespacedStore({
      namespace: () => options.namespace(),
      storage: () => options.storage()
    });
    this.#reorder = new FolderReorder(host, {
      folders: () => this.#entries.map(({ folder }) => folder),
      zone: () => options.content(),
      commit: (order) => {
        this.#applyOrder(({ folder }) => order.indexOf(folder));
        this.#commitOrder();
      },
      announce: (message) => options.announce(message)
    });
  }

  states(): Record<string, { open: boolean; }> {
    return Object.fromEntries(this.#entries.map(({ folder, key }) => [
      key,
      { open: folder.open }
    ]));
  }

  applyStates(
    states: Readonly<Record<string, { open: boolean; }>>
  ): void {
    for (const { folder, key } of this.#entries) {
      const state = states[key];
      if (state !== undefined) {
        folder.open = state.open;
      }
    }
  }

  onContentChange = () => {
    this.#reorder.cancel();
    const folders = this.#options.contentSlot()
      .assignedElements({ flatten: true })
      .filter((element): element is Folder => element.tagName === "JOLLY-FOLDER");
    const keys = folderKeys(folders);
    this.#entries = folders.map((folder, index) => {
      return {
        folder,
        key: keys[index]
      };
    });

    for (const { folder, key } of this.#entries) {
      folder.reorderable = this.#options.reorderable();
      if (folder.storageKey === "") {
        folder.storage = this.#options.storage();
        folder.persistenceKey = `${this.#options.namespace()}:folder:${key}`;
      }
    }

    const order = resolveOrder(
      parseOrder(this.#store.readJson("order")),
      this.#keys()
    );
    this.#applyOrder(({ key }) => order.indexOf(key));
    this.#options.discovered();
  };

  onFolderToggle = (
    event: Event
  ) => {
    const entry = this.#entries.find(
      ({ folder }) => folder === event.target
    );
    if (entry !== undefined) {
      this.#options.toggled(entry.key, entry.folder.open);
    }
  };

  onFolderDrag = (
    event: CustomEvent<ContainerEventMap["jolly-folder-drag"]>
  ) => {
    if (this.#options.reorderable()) {
      this.#reorder.onDrag(event);
    }
  };

  onReorderCommand = (
    event: CustomEvent<ContainerEventMap["jolly-folder-reorder"]>
  ) => {
    if (this.#options.reorderable()) {
      this.#reorder.onReorder(event);
    }
  };

  #keys(): string[] {
    return this.#entries.map(({ key }) => key);
  }

  #applyOrder(
    rank: (entry: FolderEntry) => number
  ): void {
    this.#entries = this.#entries.toSorted(
      (left, right) => rank(left) - rank(right)
    );
    for (const [index, { folder }] of this.#entries.entries()) {
      folder.style.order = String(index);
    }
  }

  #commitOrder(): void {
    const keys = this.#keys();
    this.#store.writeJson("order", keys);
    emitContainerEvent(
      this.#options.content(),
      "jolly-reorder",
      { keys }
    );
  }
}

function folderKeys(
  folders: readonly Folder[]
): string[] {
  const occurrences = new Map<string, number>();

  return folders.map((folder) => {
    if (folder.key !== "") {
      return folder.key;
    }

    const base = deriveKey(
      "jolly-folder",
      folder.label
    );
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);

    return deriveKey(
      "jolly-folder",
      folder.label,
      occurrence
    );
  });
}

function parseOrder(
  value: unknown
): string[] {
  return Array.isArray(value) && value.every((key) => typeof key === "string") ?
    value :
    [];
}
