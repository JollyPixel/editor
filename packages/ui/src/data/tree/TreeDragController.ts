// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  resolveDropIndicatorRow,
  resolveRowDropStyle,
  type DropIndicatorRow,
  type FlatTreeRow,
  type RowDropStyle,
  type TreeSnapshot
} from "./model.ts";
import { TreeDrop } from "./TreeDrop.ts";
import {
  idleTreeInteraction,
  samePointerDropPreview,
  type TreeInteraction,
  type TreePointerDropPreview
} from "./interaction.ts";
import {
  emitDataEvent,
  type TreeDropAccept
} from "./contract.ts";
import {
  startPointerDragSession,
  type PointerDragSessionHandle
} from "../../interaction/pointer/PointerDragSession.ts";
import { isButtonElement, originatesInButton } from "../../dom.ts";

// CONSTANTS
const kRowDragThreshold = 4;
const kDefaultIndent = 16;
const kDraggingClass = "jolly-tree-dragging";

export interface TreeDragOptions<TData> {
  snapshot(): TreeSnapshot<TData>;
  visibleRows(): readonly FlatTreeRow<TData>[];
  selected(): string[];
  reorderable(): boolean;
  rowDrag(): boolean;
  acceptDrop(): TreeDropAccept | null;
  interaction(): TreeInteraction;
  setInteraction(next: TreeInteraction): void;
  rowsRect(): { top: number; left: number; } | undefined;
  elementAtPoint(clientX: number, clientY: number): Element | null;
  indentUnit(): number;
}

/**
 * Owns pointer and keyboard row drag-and-drop for jolly-tree.
 */
export class TreeDragController<TData> implements ReactiveController {
  #host: ReactiveControllerHost & EventTarget;
  #options: TreeDragOptions<TData>;
  #session: PointerDragSessionHandle | null = null;
  #dragSourceIds: readonly string[] | null = null;
  #dragSources: ReadonlySet<string> = new Set();

  dropIndicatorRow: DropIndicatorRow | null = null;

  constructor(
    host: ReactiveControllerHost & EventTarget,
    options: TreeDragOptions<TData>
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  hostUpdate(): void {
    const interaction = this.#options.interaction();
    const preview = interaction.kind === "pointer-move" ?
      interaction.preview :
      null;
    this.dropIndicatorRow = preview &&
      resolveDropIndicatorRow(this.#options.snapshot(), preview);
  }

  hostDisconnected(): void {
    this.#session?.cancel();
  }

  isDragSource(
    id: string
  ): boolean {
    const interaction = this.#options.interaction();
    if (interaction.kind !== "pointer-move") {
      return false;
    }
    if (this.#dragSourceIds !== interaction.movedIds) {
      this.#dragSourceIds = interaction.movedIds;
      this.#dragSources = new Set(interaction.movedIds);
    }

    return this.#dragSources.has(id);
  }

  isMoveCursor(
    id: string
  ): boolean {
    const interaction = this.#options.interaction();

    return interaction.kind === "keyboard-move" &&
      interaction.cursorId === id;
  }

  dropStyleFor(
    nodeId: string,
    rowIndent: string
  ): RowDropStyle {
    return resolveRowDropStyle(nodeId, rowIndent, this.dropIndicatorRow);
  }

  onGripPointerDown(
    event: PointerEvent,
    id: string
  ): void {
    if (
      !isButtonElement(event.currentTarget) ||
      event.button !== 0 ||
      !this.#options.reorderable()
    ) {
      return;
    }

    event.preventDefault();
    const selected = this.#options.selected();
    const movedIds = selected.includes(id) ? selected : [id];
    this.#beginPointerDrag(event, movedIds, {
      element: event.currentTarget,
      threshold: 0
    });
  }

  onRowPointerDown(
    event: PointerEvent,
    id: string
  ): void {
    if (
      !this.#options.reorderable() ||
      !this.#options.rowDrag() ||
      event.button !== 0 ||
      originatesInButton(event.target)
    ) {
      return;
    }

    const selected = this.#options.selected();
    const movedIds = selected.includes(id) ? selected : [id];
    this.#beginPointerDrag(event, movedIds, {
      element: event.currentTarget as HTMLElement,
      threshold: kRowDragThreshold
    });
  }

  commitKeyboardMove(): void {
    const moveState = this.#options.interaction();
    this.#options.setInteraction(idleTreeInteraction());
    if (moveState.kind !== "keyboard-move") {
      return;
    }

    const { movedIds, cursorId, where } = moveState;
    if (this.#drop(movedIds).allows(cursorId, where)) {
      emitDataEvent(this.#host, "jolly-reparent", { movedIds, targetId: cursorId, where });
    }
  }

  #beginPointerDrag(
    event: PointerEvent,
    movedIds: string[],
    options: { element: HTMLElement; threshold: number; }
  ): void {
    this.#session?.cancel();
    this.#session = startPointerDragSession({
      element: options.element,
      event,
      threshold: options.threshold,
      documentClass: kDraggingClass,
      onStart: () => {
        this.#options.setInteraction({
          kind: "pointer-move",
          movedIds,
          preview: null
        });
      },
      onMove: (clientX, clientY) => {
        this.#previewDrop(clientX, clientY, movedIds);
      },
      onFinish: (result, started) => {
        const interaction = this.#options.interaction();
        const preview = interaction.kind === "pointer-move" ?
          interaction.preview :
          null;
        this.#session = null;
        this.#options.setInteraction(idleTreeInteraction(
          started && result === "commit"
        ));
        if (result === "commit" && preview !== null) {
          emitDataEvent(this.#host, "jolly-reparent", {
            movedIds,
            targetId: preview.targetId,
            where: preview.where
          });
        }
      }
    });
  }

  #drop(
    movedIds: string[]
  ): TreeDrop<TData> {
    return new TreeDrop({
      snapshot: this.#options.snapshot(),
      rows: this.#options.visibleRows(),
      movedIds,
      accept: this.#options.acceptDrop()
    });
  }

  #previewDrop(
    clientX: number,
    clientY: number,
    movedIds: string[]
  ): void {
    const target = this.#options.elementAtPoint(clientX, clientY);
    const rowElement = target instanceof Element ?
      target.closest<HTMLElement>(".row") :
      null;
    const rowId = rowElement?.dataset.id;
    if (rowElement !== null && rowId === undefined) {
      this.#setPointerPreview(null);

      return;
    }

    const rect = rowElement?.getBoundingClientRect();
    this.#setPointerPreview(this.#drop(movedIds).resolve({
      clientX,
      clientY,
      row: rect === undefined || rowId === undefined ?
        null :
        {
          id: rowId,
          top: rect.top,
          height: rect.height
        },
      container: this.#options.rowsRect(),
      indentUnit: this.#options.indentUnit() || kDefaultIndent
    }));
  }

  #setPointerPreview(
    preview: TreePointerDropPreview | null
  ): void {
    const interaction = this.#options.interaction();
    if (
      interaction.kind !== "pointer-move" ||
      samePointerDropPreview(interaction.preview, preview)
    ) {
      return;
    }

    this.#options.setInteraction({
      ...interaction,
      preview
    });
  }
}
