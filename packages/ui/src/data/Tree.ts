// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";

// Import Internal Dependencies
import { canDrop } from "./resolveReparent.ts";
import { resolveRename } from "./resolveRename.ts";
import { resolveRowDropZone } from "./dropZone.ts";
import { resolveSelection } from "./selection.ts";
import {
  findNode,
  flattenVisible,
  type FlatTreeRow
} from "./treeNodes.ts";
import { emitDataEvent } from "./events.ts";
import { treeStyles } from "./Tree.styles.ts";
import type { TreeDropWhere, TreeNode } from "./Tree.types.ts";

// Registers the chevron, eye, lock and drag glyphs.
import "../icon/Icon.ts";
import { isButtonElement } from "../dom.ts";

interface DragPreview {
  targetId: string;
  where: TreeDropWhere;
}

interface MoveState {
  movedIds: string[];
  cursorId: string;
  where: TreeDropWhere;
}

// CONSTANTS
const kDraggingClass = "jolly-tree-dragging";
const kRowDragThreshold = 4;

/**
 * A generic tree of `{ id, label, children }` rows, with drag and drop
 * reparenting, keyboard navigation and optional visibility/lock toggles.
 * Knows nothing about what a row represents.
 *
 * Fully controlled: `nodes`, `selected` and `expanded` are consumer owned,
 * the same as `value` on a field. A drop, a toggle or a selection change
 * emits an intent event; the element repaints only once the consumer writes
 * the new value back. See `docs/api/data/tree.md`.
 */
@customElement("jolly-tree")
export class Tree<TData = unknown> extends LitElement {
  static override styles = treeStyles;

  @property({ attribute: false })
  declare nodes: TreeNode<TData>[];

  @property({ attribute: false })
  declare selected: string[];

  @property({ attribute: false })
  declare expanded: string[];

  @property({ type: Boolean, reflect: true })
  declare multiple: boolean;

  @property({ type: Boolean, reflect: true })
  declare reorderable: boolean;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "row-drag"
  })
  declare rowDrag: boolean;

  @property({ type: Boolean, reflect: true })
  declare renamable: boolean;

  @state()
  private declare _renamingId: string | null;

  @state()
  private declare _anchorId: string | null;

  @state()
  private declare _dragPreview: DragPreview | null;

  @state()
  private declare _dragMovedIds: string[] | null;

  @state()
  private declare _moveState: MoveState | null;

  #suppressClick = false;

  constructor() {
    super();

    this.nodes = [];
    this.selected = [];
    this.expanded = [];
    this.multiple = false;
    this.reorderable = false;
    this.rowDrag = false;
    this.renamable = false;
    this._renamingId = null;
    this._anchorId = null;
    this._dragPreview = null;
    this._dragMovedIds = null;
    this._moveState = null;
  }

  override render(): TemplateResult {
    const rows = this.#visibleRows();
    const activeId = this.#activeId(rows);

    return html`
      <div
        class="rows"
        role="tree"
        aria-multiselectable=${this.multiple ? "true" : "false"}
        @keydown=${this.#onKeyDown}
      >${rows.map((row) => this.#renderRow(row, row.node.id === activeId))}</div>
    `;
  }

  #renderRow(
    row: FlatTreeRow<TData>,
    active: boolean
  ): TemplateResult {
    const { node, depth } = row;
    const isBranch = node.children !== undefined;
    const isExpanded = this.expanded.includes(node.id);
    const isSelected = this.selected.includes(node.id);
    const isDragSource = this._dragMovedIds?.includes(node.id) ?? false;
    const drop = this._dragPreview?.targetId === node.id ? this._dragPreview.where : null;
    const isMoveCursor = this._moveState?.cursorId === node.id;
    const expandedState = isBranch ? String(isExpanded) : nothing;
    const isHidden = node.visible === false;

    return html`
      <div
        class="row"
        role="treeitem"
        data-id=${node.id}
        tabindex=${active ? "0" : "-1"}
        aria-selected=${isSelected ? "true" : "false"}
        aria-expanded=${expandedState}
        data-dragging=${isDragSource ? "true" : nothing}
        data-drop=${drop ?? nothing}
        data-move-cursor=${isMoveCursor ? "true" : nothing}
        data-hidden=${isHidden ? "true" : nothing}
        style="padding-inline-start: calc(${depth} * var(--jolly-tree-indent, 16px))"
        @click=${(event: MouseEvent) => this.#onRowClick(event, node.id)}
        @dblclick=${(event: MouseEvent) => this.#onRowDoubleClick(event, node.id)}
        @pointerdown=${(event: PointerEvent) => this.#onRowPointerDown(event, node.id)}
      >
        ${isBranch ? html`
          <button
            class="toggle"
            type="button"
            tabindex="-1"
            aria-label=${isExpanded ? "Collapse" : "Expand"}
            @click=${(event: Event) => this.#onToggleExpand(event, node.id)}
          ><jolly-icon name="chevron" aria-hidden="true"></jolly-icon></button>
        ` : html`<span class="toggle-spacer"></span>`}
        ${node.icon === undefined ? nothing : html`
          <jolly-icon class="node-icon" name=${node.icon} aria-hidden="true"></jolly-icon>
        `}
        ${this.#renderLabel(node)}
        ${node.visible === undefined ? nothing : html`
          <button
            class="visible-toggle"
            type="button"
            tabindex="-1"
            data-active=${node.visible ? "true" : "false"}
            aria-label=${node.visible ? "Hide" : "Show"}
            aria-pressed=${node.visible ? "true" : "false"}
            @click=${(event: Event) => this.#onToggleVisible(event, node.id)}
          ><jolly-icon name="eye" aria-hidden="true"></jolly-icon></button>
        `}
        ${node.locked === undefined ? nothing : html`
          <button
            class="lock-toggle"
            type="button"
            tabindex="-1"
            data-active=${node.locked ? "true" : "false"}
            aria-label=${node.locked ? "Unlock" : "Lock"}
            aria-pressed=${node.locked ? "true" : "false"}
            @click=${(event: Event) => this.#onToggleLock(event, node.id)}
          ><jolly-icon name="lock" aria-hidden="true"></jolly-icon></button>
        `}
        ${this.reorderable ? html`
          <button
            class="grip"
            type="button"
            tabindex="-1"
            aria-hidden="true"
            @pointerdown=${(event: PointerEvent) => this.#onGripPointerDown(event, node.id)}
          ><jolly-icon name="drag" aria-hidden="true"></jolly-icon></button>
        ` : nothing}
      </div>
    `;
  }

  #visibleRows(): FlatTreeRow<TData>[] {
    return flattenVisible(this.nodes, new Set(this.expanded));
  }

  /**
   * Row the roving tabindex sits on: the first selected row when one is
   * visible, otherwise the first visible row.
   */
  #activeId(
    rows: readonly FlatTreeRow<TData>[]
  ): string | null {
    if (rows.length === 0) {
      return null;
    }

    const selectedAnchor = this.selected[0];
    if (selectedAnchor !== undefined && rows.some((row) => row.node.id === selectedAnchor)) {
      return selectedAnchor;
    }

    return rows[0].node.id;
  }

  #onRowClick(
    event: MouseEvent,
    id: string
  ): void {
    if (this.#suppressClick) {
      this.#suppressClick = false;

      return;
    }

    if (isButtonElement(event.target)) {
      return;
    }

    const result = resolveSelection({
      rows: this.#visibleRows(),
      clickedId: id,
      current: this.selected,
      anchorId: this._anchorId,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey || event.metaKey,
      multiple: this.multiple
    });
    this._anchorId = result.anchorId;
    emitDataEvent(this, "jolly-select", { selected: result.selected });
  }

  protected override updated(
    changed: Map<string, unknown>
  ): void {
    if (
      changed.has("_renamingId") &&
      this._renamingId !== null
    ) {
      this.renderRoot.querySelector<HTMLInputElement>(".rename")?.focus();
    }
  }

  #renderLabel(
    node: TreeNode<TData>
  ): TemplateResult {
    if (this._renamingId !== node.id) {
      return html`<span class="label">${node.label}</span>`;
    }

    return html`
      <input
        class="label rename"
        type="text"
        .value=${node.label}
        aria-label="Rename"
        @keydown=${this.#onRenameKeyDown}
        @blur=${(event: FocusEvent) => this.#commitRename(event.target, node)}
        @focus=${this.#onRenameFocus}
      >
    `;
  }

  #isRenamable(
    id: string
  ): boolean {
    return this.renamable &&
      findNode(this.nodes, id)?.renamable === true;
  }

  #startRename(
    id: string
  ): void {
    if (this.#isRenamable(id)) {
      this._renamingId = id;
    }
  }

  readonly #onRenameFocus = (
    event: FocusEvent
  ): void => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      input.select();
    }
  };

  readonly #onRenameKeyDown = (
    event: KeyboardEvent
  ): void => {
    // The tree's own navigation must not read the keys typed into the field.
    event.stopPropagation();

    if (event.key === "Escape") {
      event.preventDefault();
      this.#cancelRename();
    }
    else if (event.key === "Enter") {
      event.preventDefault();
      // Blur commits, so the two paths cannot double-emit.
      (event.target as HTMLInputElement).blur();
    }
  };

  #cancelRename(): void {
    const id = this._renamingId;
    this._renamingId = null;
    if (id !== null) {
      this.#focusRow(id);
    }
  }

  /**
   * Emits the edit unless it was cancelled, left blank, or left unchanged.
   * The label is not written here: `nodes` stays consumer owned.
   */
  #commitRename(
    target: EventTarget | null,
    node: TreeNode<TData>
  ): void {
    if (this._renamingId !== node.id) {
      return;
    }

    this._renamingId = null;
    const name = resolveRename(
      node.label,
      target instanceof HTMLInputElement ? target.value : ""
    );
    if (name !== null) {
      emitDataEvent(this, "jolly-rename", { id: node.id, name });
    }
    this.#focusRow(node.id);
  }

  #focusRow(
    id: string
  ): void {
    this.updateComplete.then(() => {
      const row = this.renderRoot.querySelector<HTMLElement>(
        `.row[data-id="${CSS.escape(id)}"]`
      );
      row?.focus();
    });
  }

  #onRowDoubleClick(
    event: MouseEvent,
    id: string
  ): void {
    if (isButtonElement(event.target)) {
      return;
    }

    if (this.#isRenamable(id)) {
      event.preventDefault();
      this.#startRename(id);

      return;
    }

    emitDataEvent(this, "jolly-activate", { id });
  }

  #onToggleExpand(
    event: Event,
    id: string
  ): void {
    event.stopPropagation();
    emitDataEvent(this, "jolly-toggle-expand", {
      id,
      expanded: !this.expanded.includes(id)
    });
  }

  #onToggleVisible(
    event: Event,
    id: string
  ): void {
    event.stopPropagation();
    const node = findNode(this.nodes, id);
    if (node === null || node.visible === undefined) {
      return;
    }

    emitDataEvent(this, "jolly-toggle-visible", { id, visible: !node.visible });
  }

  #onToggleLock(
    event: Event,
    id: string
  ): void {
    event.stopPropagation();
    const node = findNode(this.nodes, id);
    if (node === null || node.locked === undefined) {
      return;
    }

    emitDataEvent(this, "jolly-toggle-lock", { id, locked: !node.locked });
  }

  #selectSingle(
    id: string
  ): void {
    this._anchorId = id;
    emitDataEvent(this, "jolly-select", { selected: [id] });
  }

  /**
   * Keyboard half of navigation, selection and reparenting.
   *
   * The drag handle is pointer-only; a row's own roving tabindex is the
   * keyboard entry point for reordering (Space arms it), which scales to a
   * tree of many rows better than a separately focusable grip per row would.
   */
  #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const rows = this.#visibleRows();
    if (rows.length === 0) {
      return;
    }

    if (this._moveState !== null) {
      this.#onMoveKeyDown(event, rows);

      return;
    }

    const activeId = this.#activeId(rows);
    const activeIndex = rows.findIndex((row) => row.node.id === activeId);
    if (activeIndex === -1) {
      return;
    }
    const activeRow = rows[activeIndex];

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = rows[Math.min(activeIndex + 1, rows.length - 1)];
        this.#selectSingle(next.node.id);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const previous = rows[Math.max(activeIndex - 1, 0)];
        this.#selectSingle(previous.node.id);
        break;
      }
      case "ArrowRight": {
        if (activeRow.node.children === undefined) {
          break;
        }
        event.preventDefault();
        if (this.expanded.includes(activeRow.node.id)) {
          const next = rows[activeIndex + 1];
          if (next !== undefined && next.parentId === activeRow.node.id) {
            this.#selectSingle(next.node.id);
          }
        }
        else {
          emitDataEvent(this, "jolly-toggle-expand", { id: activeRow.node.id, expanded: true });
        }
        break;
      }
      case "ArrowLeft": {
        event.preventDefault();
        if (activeRow.node.children !== undefined && this.expanded.includes(activeRow.node.id)) {
          emitDataEvent(this, "jolly-toggle-expand", { id: activeRow.node.id, expanded: false });
        }
        else if (activeRow.parentId !== null) {
          this.#selectSingle(activeRow.parentId);
        }
        break;
      }
      case "F2":
        if (!this.#isRenamable(activeRow.node.id)) {
          break;
        }
        event.preventDefault();
        this.#startRename(activeRow.node.id);
        break;
      case "Enter":
        event.preventDefault();
        emitDataEvent(this, "jolly-activate", { id: activeRow.node.id });
        break;
      case " ":
        if (!this.reorderable) {
          break;
        }
        event.preventDefault();
        this.#armMoveState(rows, activeRow);
        break;
      default:
        break;
    }
  };

  #armMoveState(
    rows: readonly FlatTreeRow<TData>[],
    activeRow: FlatTreeRow<TData>
  ): void {
    const movedIds = this.selected.includes(activeRow.node.id) ? this.selected : [activeRow.node.id];
    const cursor = rows.find((row) => !movedIds.includes(row.node.id));
    if (cursor === undefined) {
      return;
    }

    this._moveState = { movedIds, cursorId: cursor.node.id, where: "below" };
  }

  #onMoveKeyDown(
    event: KeyboardEvent,
    rows: readonly FlatTreeRow<TData>[]
  ): void {
    const moveState = this._moveState;
    if (moveState === null) {
      return;
    }
    const cursorIndex = rows.findIndex((row) => row.node.id === moveState.cursorId);

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = rows.slice(cursorIndex + 1).find((row) => !moveState.movedIds.includes(row.node.id));
        if (next !== undefined) {
          this._moveState = { ...moveState, cursorId: next.node.id };
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const before = rows.slice(0, cursorIndex).reverse();
        const previous = before.find((row) => !moveState.movedIds.includes(row.node.id));
        if (previous !== undefined) {
          this._moveState = { ...moveState, cursorId: previous.node.id };
        }
        break;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        event.preventDefault();
        const order: TreeDropWhere[] = ["above", "inside", "below"];
        const position = order.indexOf(moveState.where);
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const nextPosition = (position + delta + order.length) % order.length;
        this._moveState = { ...moveState, where: order[nextPosition] };
        break;
      }
      case "Enter":
        event.preventDefault();
        this.#commitMove();
        break;
      case "Escape":
        event.preventDefault();
        this._moveState = null;
        break;
      default:
        break;
    }
  }

  #commitMove(): void {
    const moveState = this._moveState;
    this._moveState = null;
    if (moveState === null) {
      return;
    }

    const { movedIds, cursorId, where } = moveState;
    if (canDrop({ nodes: this.nodes, movedIds, targetId: cursorId, where })) {
      emitDataEvent(this, "jolly-reparent", { movedIds, targetId: cursorId, where });
    }
  }

  #onGripPointerDown(
    event: PointerEvent,
    id: string
  ): void {
    if (
      !isButtonElement(event.currentTarget) ||
      event.button !== 0 ||
      !this.reorderable
    ) {
      return;
    }

    event.preventDefault();
    const movedIds = this.selected.includes(id) ? this.selected : [id];
    this.#beginPointerDrag(event, movedIds, {
      element: event.currentTarget,
      // The grip's only purpose is to start a drag, so it arms immediately.
      threshold: 0
    });
  }

  /**
   * Whole-row drag, gated by `rowDrag`: the row itself is also a valid drag
   * origin, not only its grip — the interaction `arbor` had.
   *
   * A plain click must keep working, so this only arms past a movement
   * threshold; `#onRowClick` checks `#suppressClick` to swallow the `click`
   * that still follows `pointerup` once it has.
   */
  #onRowPointerDown(
    event: PointerEvent,
    id: string
  ): void {
    if (
      !this.reorderable ||
      !this.rowDrag ||
      event.button !== 0 ||
      isButtonElement(event.target)
    ) {
      return;
    }

    const movedIds = this.selected.includes(id) ? this.selected : [id];
    this.#beginPointerDrag(event, movedIds, {
      element: event.currentTarget as HTMLElement,
      threshold: kRowDragThreshold
    });
  }

  #beginPointerDrag(
    event: PointerEvent,
    movedIds: string[],
    options: { element: HTMLElement; threshold: number; }
  ): void {
    const { element, threshold } = options;
    const pointerId = event.pointerId;
    const originX = event.clientX;
    const originY = event.clientY;
    const self = this;
    let armed = false;

    function arm(): void {
      armed = true;
      element.setPointerCapture(pointerId);
      self.#suppressClick = true;
      self._dragMovedIds = movedIds;
      document.documentElement.classList.add(kDraggingClass);
    }

    function onMove(
      moveEvent: PointerEvent
    ): void {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }
      if (!armed) {
        const distance = Math.hypot(moveEvent.clientX - originX, moveEvent.clientY - originY);
        if (distance < threshold) {
          return;
        }
        arm();
      }
      self.#previewDrop(moveEvent.clientX, moveEvent.clientY, movedIds);
    }

    function onKeyDown(
      keyEvent: KeyboardEvent
    ): void {
      if (keyEvent.key !== "Escape") {
        return;
      }
      keyEvent.preventDefault();
      finish(false);
    }

    function finish(
      commit: boolean
    ): void {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKeyDown, true);
      if (!armed) {
        return;
      }

      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      document.documentElement.classList.remove(kDraggingClass);

      const preview = self._dragPreview;
      self._dragPreview = null;
      self._dragMovedIds = null;
      if (commit && preview !== null) {
        emitDataEvent(self, "jolly-reparent", {
          movedIds,
          targetId: preview.targetId,
          where: preview.where
        });
      }
    }

    function onUp(
      upEvent: PointerEvent
    ): void {
      if (upEvent.pointerId === pointerId) {
        finish(true);
      }
    }
    function onCancel(
      cancelEvent: PointerEvent
    ): void {
      if (cancelEvent.pointerId === pointerId) {
        finish(false);
      }
    }

    if (threshold === 0) {
      arm();
    }
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onKeyDown, true);
  }

  #previewDrop(
    clientX: number,
    clientY: number,
    movedIds: string[]
  ): void {
    const target = this.shadowRoot?.elementFromPoint(clientX, clientY) ?? null;
    const rowElement = target instanceof Element ? target.closest<HTMLElement>(".row") : null;
    if (rowElement === null) {
      this._dragPreview = null;

      return;
    }

    const targetId = rowElement.dataset.id;
    if (targetId === undefined) {
      this._dragPreview = null;

      return;
    }

    const rect = rowElement.getBoundingClientRect();
    const where = resolveRowDropZone(clientY - rect.top, rect.height);

    this._dragPreview = canDrop({ nodes: this.nodes, movedIds, targetId, where }) ?
      { targetId, where } :
      null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-tree": Tree;
  }
}
