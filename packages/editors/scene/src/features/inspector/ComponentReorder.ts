// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import {
  SlidingReorder,
  resolveDropIndex,
  startPointerDragSession,
  type ContainerEventMap,
  type Folder,
  type PointerDragSessionHandle
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { componentMove } from "./componentMove.ts";

type FolderDragEvent = CustomEvent<ContainerEventMap["jolly-folder-drag"]>;
type FolderReorderEvent = CustomEvent<ContainerEventMap["jolly-folder-reorder"]>;

// CONSTANTS
const kDragThreshold = 4;

export interface ComponentReorderOptions {
  folders(): Folder[];
  move(id: string, beforeId?: string): void;
}

interface KeyboardGrab {
  id: string;
  order: string[];
}

export class ComponentReorder implements ReactiveController {
  readonly #options: ComponentReorderOptions;
  #ids: string[] | null = null;
  #drag: PointerDragSessionHandle | null = null;
  #grab: KeyboardGrab | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: ComponentReorderOptions
  ) {
    host.addController(this);
    this.#options = options;
  }

  hostUpdated(): void {
    if (this.#ids === null || sameOrder(this.#keys(), this.#ids)) {
      return;
    }

    this.#drag?.cancel();
    this.#release();
  }

  hostDisconnected(): void {
    this.#drag?.cancel();
    this.#release();
  }

  onDrag = (
    event: FolderDragEvent
  ) => {
    event.stopPropagation();
    const { folder, event: pointer } = event.detail;
    const handle = pointer.currentTarget;
    const folders = this.#options.folders();
    const from = folders.indexOf(folder);
    if (
      this.#ids !== null ||
      from === -1 ||
      !(handle instanceof HTMLElement)
    ) {
      return;
    }

    const ids = folders.map(({ key }) => key);
    let reorder: SlidingReorder | null = null;
    let current: number | null = null;
    this.#ids = ids;
    this.#drag = startPointerDragSession({
      element: handle,
      event: pointer,
      threshold: kDragThreshold,
      suppressClick: true,
      onStart: () => {
        reorder = new SlidingReorder({
          items: folders,
          from,
          axis: "y",
          pointer: pointer.clientY
        });
      },
      onMove: (clientX, clientY) => {
        if (reorder === null) {
          return;
        }

        current = resolveDropIndex({
          position: clientY,
          candidates: reorder.candidates,
          current
        });
        reorder.preview(current, clientX, clientY);
      },
      onFinish: (result) => {
        this.#drag = null;
        this.#ids = null;
        if (reorder === null) {
          return;
        }

        const move = result === "commit" && current !== null ?
          componentMove(ids, from, current) :
          null;
        void reorder.settle(() => {
          if (move !== null) {
            this.#options.move(move.id, move.beforeId);
          }
        });
      }
    });
  };

  onReorder = (
    event: FolderReorderEvent
  ) => {
    event.stopPropagation();
    const { folder, command } = event.detail;
    if (command === "start") {
      this.#start(folder.key);

      return;
    }

    const grab = this.#grab;
    if (grab === null || grab.id !== folder.key) {
      return;
    }

    switch (command) {
      case "up":
      case "down":
        this.#shift(grab, command === "up" ? -1 : 1);
        break;
      case "cancel":
        this.#release();
        break;
      case "finish":
        this.#finish(grab);
        break;
    }
  };

  #start(
    id: string
  ): void {
    if (this.#ids !== null) {
      return;
    }

    const ids = this.#keys();
    this.#ids = ids;
    this.#grab = {
      id,
      order: [...ids]
    };
  }

  #shift(
    grab: KeyboardGrab,
    step: -1 | 1
  ): void {
    const { id, order } = grab;
    const index = order.indexOf(id);
    const next = index + step;
    if (next < 0 || next >= order.length) {
      return;
    }

    [order[index], order[next]] = [order[next], order[index]];
    for (const folder of this.#options.folders()) {
      folder.style.order = String(order.indexOf(folder.key));
    }
  }

  #finish(
    grab: KeyboardGrab
  ): void {
    const ids = this.#ids ?? [];
    const from = ids.indexOf(grab.id);
    const to = grab.order.indexOf(grab.id);
    this.#release();

    const move = componentMove(ids, from, to > from ? to + 1 : to);
    if (move !== null) {
      this.#options.move(move.id, move.beforeId);
    }
  }

  #release(): void {
    if (this.#grab !== null) {
      for (const folder of this.#options.folders()) {
        folder.style.order = "";
      }
    }
    this.#grab = null;
    this.#ids = null;
  }

  #keys(): string[] {
    return this.#options.folders().map(({ key }) => key);
  }
}

function sameOrder(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return left.length === right.length &&
    left.every((key, index) => key === right[index]);
}
