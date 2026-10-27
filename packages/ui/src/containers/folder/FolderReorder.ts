// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import type { ContainerEventMap } from "../events.ts";
import type { Folder } from "./Folder.ts";
import { headerGhost } from "../../interaction/drag/dragGhost.ts";
import {
  startDragSession,
  verticalInsertionLine,
  type DragSessionHandle
} from "../../interaction/drag/DragSession.ts";

type FolderDragEvent = CustomEvent<ContainerEventMap["jolly-folder-drag"]>;
type FolderReorderEvent = CustomEvent<ContainerEventMap["jolly-folder-reorder"]>;

// CONSTANTS
const kFolderZone = "folders";

export interface FolderReorderOptions {
  folders(): readonly Folder[];
  zone(): HTMLElement;
  commit(order: readonly Folder[], folder: Folder): void;
  announce(message: string): void;
}

interface DragGesture {
  kind: "drag";
  start: readonly Folder[];
  session: DragSessionHandle;
}

interface KeyboardGrab {
  kind: "grab";
  folder: Folder;
  start: readonly Folder[];
  order: Folder[];
  styles: string[];
}

export class FolderReorder implements ReactiveController {
  readonly #options: FolderReorderOptions;
  #gesture: DragGesture | KeyboardGrab | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: FolderReorderOptions
  ) {
    host.addController(this);
    this.#options = options;
  }

  hostUpdated(): void {
    const gesture = this.#gesture;
    if (
      gesture !== null &&
      !sameFolders(gesture.start, this.#options.folders())
    ) {
      this.cancel();
    }
  }

  hostDisconnected(): void {
    this.cancel();
  }

  cancel(): void {
    const gesture = this.#gesture;
    if (gesture?.kind === "drag") {
      this.#gesture = null;
      gesture.session.cancel();
    }
    else if (gesture?.kind === "grab") {
      this.#release(gesture);
    }
  }

  onDrag = (
    event: FolderDragEvent
  ) => {
    event.stopPropagation();
    const { folder, event: pointer } = event.detail;
    const folders = [...this.#options.folders()];
    const from = folders.indexOf(folder);
    if (this.#gesture !== null || from === -1) {
      return;
    }

    const bounds = readRect(this.#options.zone());
    const candidates = folders.map((item) => {
      const rect = item.getBoundingClientRect();

      return { start: rect.y, size: rect.height };
    });
    const session = startDragSession({
      source: folder,
      event: pointer,
      handle: pointer.currentTarget instanceof HTMLElement ?
        pointer.currentTarget :
        folder,
      ghostLabel: folder.label,
      ghostElement: () => {
        const ghost = headerGhost(folder);
        ghost.label = folder.label;

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
        folder.dragging = true;
      },
      onCommit: (result) => {
        if (result.zone !== null) {
          this.#drop(folders, from, result.index);
        }
      },
      onEnd: () => {
        folder.dragging = false;
        if (this.#gesture?.kind === "drag" && this.#gesture.session === session) {
          this.#gesture = null;
        }
      }
    });
    this.#gesture = {
      kind: "drag",
      start: folders,
      session
    };
  };

  onReorder = (
    event: FolderReorderEvent
  ) => {
    event.stopPropagation();
    const { folder, command } = event.detail;
    if (command === "start") {
      this.#grab(folder);

      return;
    }

    const grab = this.#gesture;
    if (grab?.kind !== "grab" || grab.folder !== folder) {
      return;
    }

    switch (command) {
      case "up":
      case "down":
        this.#step(grab, command === "up" ? -1 : 1);
        break;
      case "cancel":
        this.#release(grab);
        this.#options.announce(`${folder.label} movement cancelled`);
        break;
      case "finish":
        this.#finish(grab);
        break;
    }
  };

  #grab(
    folder: Folder
  ): void {
    const folders = [...this.#options.folders()];
    if (this.#gesture !== null || !folders.includes(folder)) {
      return;
    }

    this.#gesture = {
      kind: "grab",
      folder,
      start: folders,
      order: [...folders],
      styles: folders.map((item) => item.style.order)
    };
    folder.grabbed = true;
    this.#options.announce(`${folder.label} grabbed`);
  }

  #step(
    grab: KeyboardGrab,
    step: -1 | 1
  ): void {
    const { folder, order } = grab;
    const index = order.indexOf(folder);
    const next = index + step;
    if (next < 0 || next >= order.length) {
      return;
    }

    [order[index], order[next]] = [order[next], order[index]];
    for (const [position, item] of order.entries()) {
      item.style.order = String(position);
    }
    this.#options.announce(
      `${folder.label}, position ${next + 1} of ${order.length}`
    );
  }

  #finish(
    grab: KeyboardGrab
  ): void {
    this.#release(grab);
    if (!sameFolders(grab.start, grab.order)) {
      this.#options.commit(grab.order, grab.folder);
    }
    this.#options.announce(`${grab.folder.label} dropped`);
  }

  #drop(
    folders: readonly Folder[],
    from: number,
    insertion: number
  ): void {
    const to = insertion > from ? insertion - 1 : insertion;
    if (to === from) {
      return;
    }

    const folder = folders[from];
    const order = folders.toSpliced(from, 1).toSpliced(to, 0, folder);
    this.#options.commit(order, folder);
    this.#options.announce(
      `${folder.label}, position ${to + 1} of ${order.length}`
    );
  }

  #release(
    grab: KeyboardGrab
  ): void {
    this.#gesture = null;
    grab.folder.grabbed = false;
    for (const [index, item] of grab.start.entries()) {
      item.style.order = grab.styles[index];
    }
  }
}

function sameFolders(
  left: readonly Folder[],
  right: readonly Folder[]
): boolean {
  return left.length === right.length &&
    left.every((folder, index) => folder === right[index]);
}

function readRect(
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
