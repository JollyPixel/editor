// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { emitContainerEvent } from "./events.ts";
import type { Folder } from "./Folder.ts";
import { detailOf } from "../dom.ts";
import { headerGhost } from "../interaction/drag/dragGhost.ts";
import {
  startDragSession,
  verticalInsertionLine,
  type DragSessionHandle
} from "../interaction/drag/DragSession.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import {
  deriveKey,
  resolveOrder
} from "../storage/keys.ts";

// CONSTANTS
const kFolderZone = "folders";

interface FolderEntry {
  folder: Folder;
  key: string;
}

interface FolderReorderDetail {
  folder: Folder;
  command: "cancel" | "down" | "finish" | "start" | "up";
}

interface FolderDragDetail {
  folder: Folder;
  event: PointerEvent;
}

export interface FolderListOptions {
  content(): HTMLElement;
  contentSlot(): HTMLSlotElement;
  namespace(): string;
  reorderable(): boolean;
  storage(): StorageAdapter;
  announce(message: string): void;
}

/**
 * Owns folder identity and ordering for the pane that slots them.
 */
export class FolderListController implements ReactiveController {
  readonly #options: FolderListOptions;
  #entries: FolderEntry[] = [];
  #startOrder: string[] | null = null;
  #session: DragSessionHandle | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: FolderListOptions
  ) {
    host.addController(this);
    this.#options = options;
  }

  hostDisconnected(): void {
    this.#session?.cancel();
    this.#session = null;
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

    this.#applyOrder(resolveOrder(
      parseOrder(
        this.#options.storage().get(`${this.#options.namespace()}:order`)
      ),
      this.#keys()
    ));
  };

  onFolderDrag = (
    event: Event
  ) => {
    if (!this.#options.reorderable()) {
      return;
    }

    event.stopPropagation();
    const detail = detailOf<FolderDragDetail>(event);
    if (detail === null || this.#session !== null) {
      return;
    }

    const ordered = this.#entries;
    const from = ordered.findIndex(
      ({ folder }) => folder === detail.folder
    );
    if (from === -1) {
      return;
    }

    const bounds = rectOf(this.#options.content());
    const candidates = ordered.map(({ folder }) => {
      const rect = folder.getBoundingClientRect();

      return { start: rect.y, size: rect.height };
    });

    this.#session = startDragSession({
      source: detail.folder,
      event: detail.event,
      handle: detail.event.currentTarget instanceof HTMLElement ?
        detail.event.currentTarget :
        detail.folder,
      ghostLabel: detail.folder.label,
      ghostElement: () => {
        const ghost = headerGhost(detail.folder);
        ghost.label = detail.folder.label;

        return ghost;
      },
      zones: () => [{
        id: kFolderZone,
        rect: bounds,
        candidates,
        axis: "y",
        line: (index) => verticalInsertionLine(bounds, candidates, index)
      }],
      onStart: () => {
        detail.folder.dragging = true;
      },
      onCommit: (result) => {
        if (result.zone !== null) {
          this.#move(from, result.index);
        }
      },
      onEnd: () => {
        this.#session = null;
        detail.folder.dragging = false;
      }
    });
  };

  onReorderCommand = (
    event: Event
  ) => {
    if (!this.#options.reorderable()) {
      return;
    }

    event.stopPropagation();
    const detail = detailOf<FolderReorderDetail>(event);
    if (detail === null) {
      return;
    }

    const order = this.#keys();
    const index = this.#entries.findIndex(
      ({ folder }) => folder === detail.folder
    );
    if (index === -1) {
      return;
    }

    if (detail.command === "start") {
      this.#startOrder = order;
      this.#options.announce(`${detail.folder.label} grabbed`);

      return;
    }
    if (detail.command === "cancel") {
      if (this.#startOrder !== null) {
        this.#applyOrder(this.#startOrder);
      }
      this.#startOrder = null;
      this.#options.announce(
        `${detail.folder.label} movement cancelled`
      );

      return;
    }
    if (detail.command === "finish") {
      this.#commitOrder();
      this.#startOrder = null;
      this.#options.announce(
        `${detail.folder.label} dropped`
      );

      return;
    }

    const next = Math.min(
      Math.max(index + (detail.command === "up" ? -1 : 1), 0),
      order.length - 1
    );
    if (index === next) {
      return;
    }

    [order[index], order[next]] = [order[next], order[index]];
    this.#applyOrder(order);
    this.#options.announce(
      `${detail.folder.label}, position ${next + 1} of ${order.length}`
    );
  };

  #move(
    from: number,
    insertion: number
  ): void {
    const order = this.#keys();
    const to = insertion > from ? insertion - 1 : insertion;
    if (to === from || to < 0 || to >= order.length) {
      return;
    }

    const [key] = order.splice(from, 1);
    order.splice(to, 0, key);
    this.#applyOrder(order);
    this.#commitOrder();
    this.#options.announce(
      `${this.#entries[from]?.folder.label ?? "Folder"}, position ` +
      `${to + 1} of ${order.length}`
    );
  }

  #keys(): string[] {
    return this.#entries.map(({ key }) => key);
  }

  #applyOrder(
    order: readonly string[]
  ): void {
    const entries = new Map(
      this.#entries.map((entry) => [entry.key, entry])
    );
    this.#entries = order.flatMap((key) => {
      const entry = entries.get(key);

      return entry === undefined ? [] : [entry];
    });
    for (const [index, { folder }] of this.#entries.entries()) {
      folder.style.order = String(index);
    }
  }

  #commitOrder(): void {
    const keys = this.#keys();
    this.#options.storage().set(
      `${this.#options.namespace()}:order`,
      JSON.stringify(keys)
    );
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

function rectOf(
  element: Element
) {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

function parseOrder(
  value: string | null
): string[] {
  if (value === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) && parsed.every((key) => typeof key === "string") ?
      parsed :
      [];
  }
  catch {
    return [];
  }
}
