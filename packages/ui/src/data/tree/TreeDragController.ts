// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  canDrop,
  resolveDepthDropTarget,
  resolveDropIndicatorRow,
  resolveEdgeDropRows,
  resolveEdgeDropTarget,
  resolveRowDropStyle,
  resolveRowDropZone,
  type DropIndicatorRow,
  type FlatTreeRow,
  type RowDropStyle,
  type TreeSnapshot
} from "./model.ts";
import {
  idleTreeInteraction,
  type TreeInteraction,
  type TreePointerDropPreview
} from "./interaction.ts";
import {
  emitDataEvent,
  type TreeDropAccept,
  type TreeNode
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
  nodes(): TreeNode<TData>[];
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

    return interaction.kind === "pointer-move" &&
      interaction.movedIds.includes(id);
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
    if (canDrop({
      nodes: this.#options.nodes(),
      movedIds,
      targetId: cursorId,
      where,
      accept: this.#options.acceptDrop()
    }, this.#options.snapshot())) {
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

  #previewDrop(
    clientX: number,
    clientY: number,
    movedIds: string[]
  ): void {
    const rows = this.#options.visibleRows();
    const { firstRow, lastRow } = resolveEdgeDropRows(rows, movedIds, this.#options.snapshot());

    const target = this.#options.elementAtPoint(clientX, clientY);
    const rowElement = target instanceof Element ? target.closest<HTMLElement>(".row") : null;
    if (rowElement === null) {
      this.#setPointerPreview(this.#resolveEdgeDrop(rows, clientY, movedIds));

      return;
    }

    const targetId = rowElement.dataset.id;
    if (targetId === undefined) {
      this.#setPointerPreview(null);

      return;
    }

    const rect = rowElement.getBoundingClientRect();
    const where = resolveRowDropZone(rect, clientY);

    if (lastRow !== undefined && targetId === lastRow.node.id && where === "below") {
      this.#setPointerPreview(
        this.#resolveDepthDrop(lastRow, clientX, movedIds, "below")
      );

      return;
    }
    if (firstRow !== undefined && targetId === firstRow.node.id && where === "above") {
      this.#setPointerPreview(
        this.#resolveDepthDrop(firstRow, clientX, movedIds, "above")
      );

      return;
    }

    this.#setPointerPreview(canDrop({
      nodes: this.#options.nodes(),
      movedIds,
      targetId,
      where,
      accept: this.#options.acceptDrop()
    }, this.#options.snapshot()) ?
      { targetId, where, anchorId: targetId } :
      null);
  }

  #setPointerPreview(
    preview: TreePointerDropPreview | null
  ): void {
    const interaction = this.#options.interaction();
    if (interaction.kind !== "pointer-move") {
      return;
    }

    this.#options.setInteraction({
      ...interaction,
      preview
    });
  }

  #resolveEdgeDrop(
    rows: readonly FlatTreeRow<TData>[],
    clientY: number,
    movedIds: string[]
  ): TreePointerDropPreview | null {
    const containerTop = this.#options.rowsRect()?.top;
    const isAboveEverything = containerTop !== undefined && clientY < containerTop;

    return resolveEdgeDropTarget({
      nodes: this.#options.nodes(),
      movedIds,
      rows,
      where: isAboveEverything ? "above" : "below",
      accept: this.#options.acceptDrop()
    }, this.#options.snapshot());
  }

  #resolveDepthDrop(
    row: FlatTreeRow<TData>,
    clientX: number,
    movedIds: string[],
    where: "above" | "below"
  ): TreePointerDropPreview | null {
    const containerLeft = this.#options.rowsRect()?.left;
    if (containerLeft === undefined) {
      return null;
    }

    const target = resolveDepthDropTarget({
      nodes: this.#options.nodes(),
      movedIds,
      rowId: row.node.id,
      clientX,
      containerLeft,
      indentUnit: this.#options.indentUnit() || kDefaultIndent,
      where,
      accept: this.#options.acceptDrop()
    }, this.#options.snapshot());

    return target === null ? null : { ...target, anchorId: row.node.id };
  }
}
