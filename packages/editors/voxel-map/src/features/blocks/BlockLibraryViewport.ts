// Import Third-party Dependencies
import { LitElement, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type {
  VoxelEngine,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { ResizeHandle } from "@jolly-pixel/resize-handle";
import {
  LocalStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { blockLibraryViewportStyles } from "./BlockLibraryViewport.styles.ts";
import { BlockLibraryRenderer } from "./BlockLibraryRenderer.ts";
import {
  blockCellRect,
  blockCellStyle,
  blockInsertIndex,
  blockInsertMarker,
  blockMoveTargetIndex,
  revealCellScrollTop,
  type BlockCellRect,
  type BlockGridLayout
} from "./blockGridLayout.ts";
import {
  peerMarkNames,
  resolvePeerMarks,
  type PeerMarkMap,
  type PeerMarkView
} from "../../collaboration/peerMarks.ts";
import type { BlockLibraryLayout } from "./BlockLibrary.ts";

// CONSTANTS
const kBlockSelectEvent = "block-select";
const kBlockEditEvent = "block-edit";
const kBlockMoveEvent = "block-move";
const kBlockCreateEvent = "block-create";
const kCellInset = 3;
const kDragThreshold = 4;
const kAutoScrollMargin = 24;
const kAutoScrollStep = 10;
const kMinHeight = 60;
const kMaxHeight = 1200;
const kHeightStorageKey = "voxel-map:block-library:height";

interface MarkedCell {
  rect: BlockCellRect;
  view: PeerMarkView;
}

export interface BlockMoveDetail {
  id: number;
  toIndex: number;
}

interface DragSession {
  pointerId: number;
  blockId: number;
  fromIndex: number;
  originX: number;
  originY: number;
  dragging: boolean;
}

@customElement("block-library-viewport")
export class BlockLibraryViewport extends LitElement {
  static override styles = blockLibraryViewportStyles;

  @property({ attribute: false })
  declare engine: VoxelEngine;

  @property({ attribute: false })
  declare blocks: ResolvedBlockDefinition[];

  @property({ attribute: false })
  declare marks: PeerMarkMap<number>;

  @property({ attribute: false })
  declare selectedId: number | null;

  @property({ attribute: false })
  declare problems: ReadonlyMap<number, string>;

  @property({ attribute: false })
  declare unused: ReadonlySet<number>;

  @property({ type: Boolean })
  declare reorderable: boolean;

  @property({ type: String, reflect: true })
  declare layout: BlockLibraryLayout;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @property({ type: Boolean, reflect: true })
  declare sized: boolean;

  @state()
  private declare _grid: BlockGridLayout | null;

  @state()
  private declare _insertAt: number | null;

  @query(".scroller")
  declare private _scroller: HTMLDivElement;

  @query(".grip")
  declare private _grip: HTMLDivElement | null;

  #renderer: BlockLibraryRenderer | null = null;
  #drag: DragSession | null = null;
  #suppressClick = false;
  #resizeHandle: ResizeHandle | null = null;

  constructor() {
    super();
    this.blocks = [];
    this.marks = new Map();
    this.selectedId = null;
    this.problems = new Map();
    this.unused = new Set();
    this.reorderable = true;
    this.layout = "compact";
    this.storage = new LocalStorageAdapter();
    this.sized = false;
    this._grid = null;
    this._insertAt = null;
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.requestUpdate();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#endDrag();
    this.#renderer?.dispose();
    this.#renderer = null;
    this.#disconnectResizeHandle();
  }

  override updated(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("layout") || this.#resizeHandle?.handleElt !== this._grip) {
      this.#connectResizeHandle();
    }

    if (changed.has("engine") || this.#renderer === null) {
      this.#build();
    }
    else if (changed.has("blocks")) {
      this.#renderer?.setBlocks(this.blocks);
    }
    else {
      return;
    }

    void this.updateComplete.then(() => this.#syncGrid());
  }

  revealBlock(
    id: number
  ): void {
    const grid = this._grid;
    const scroller = this._scroller;
    const index = this.blocks.findIndex((block) => block.id === id);
    if (grid === null || index < 0 || !scroller) {
      return;
    }

    const scrollTop = revealCellScrollTop(
      blockCellRect(index, grid),
      {
        scrollTop: scroller.scrollTop,
        height: scroller.clientHeight
      }
    );
    if (scrollTop !== null) {
      scroller.scrollTop = scrollTop;
    }
  }

  override render() {
    const cells = this.#markedCells();

    return html`<div
      class=${this.#dragging ? "scroller dragging" : "scroller"}
      role="listbox"
      aria-label="Blocks"
      @click=${this.#onClick}
      @dblclick=${this.#onDoubleClick}
      @pointerdown=${this.#onPointerDown}
      @pointermove=${this.#onPointerMove}
      @pointerup=${this.#onPointerUp}
      @pointercancel=${this.#onPointerCancel}
    >
      <div class="layer highlights">
        ${cells.map((cell) => this.#renderHighlight(cell))}
      </div>
      <div class="layer options">
        ${this.#renderOptions()}
      </div>
      <div class="layer marks">
        ${this.#renderUnused()}
        ${this.#renderProblems()}
        ${cells.map((cell) => this.#renderMarker(cell))}
      </div>
      <div class="layer drop">
        ${this.#renderInsertion()}
      </div>
      <div class="layer actions">
        ${this.#renderAddCell()}
      </div>
    </div>
    ${this.layout === "compact" ?
      html`<div class="grip" aria-label="Block library height"></div>` :
      nothing}`;
  }

  #connectResizeHandle(): void {
    this.#disconnectResizeHandle();
    const grip = this._grip;
    if (grip === null) {
      this._scroller?.style.removeProperty("height");
      this.sized = false;

      return;
    }

    const handle = new ResizeHandle(this._scroller, {
      direction: "top",
      handle: grip,
      minSize: kMinHeight,
      maxSize: kMaxHeight
    });
    handle.addEventListener("dragStart", this.#onResizeStart);
    handle.addEventListener("dragEnd", this.#onResizeEnd);
    this.#resizeHandle = handle;

    const stored = Number(this.storage.get(kHeightStorageKey));
    if (Number.isFinite(stored) && stored >= kMinHeight) {
      this._scroller.style.height = `${Math.min(stored, kMaxHeight)}px`;
      this.sized = true;
    }
  }

  #disconnectResizeHandle(): void {
    const handle = this.#resizeHandle;
    if (handle === null) {
      return;
    }

    handle.removeEventListener("dragStart", this.#onResizeStart);
    handle.removeEventListener("dragEnd", this.#onResizeEnd);
    handle.dispose();
    this.#resizeHandle = null;
  }

  readonly #onResizeStart = (): void => {
    this.sized = true;
  };

  readonly #onResizeEnd = (): void => {
    const height = Math.round(this._scroller.getBoundingClientRect().height);
    this.storage.set(kHeightStorageKey, String(height));
  };

  #renderAddCell() {
    const grid = this._grid;
    if (grid === null || this.#dragging) {
      return nothing;
    }

    const rect = blockCellRect(this.blocks.length, grid, kCellInset);

    return html`<button
      type="button"
      class="add-cell"
      aria-label="Add block"
      title="Add block"
      style=${blockCellStyle(rect)}
      @pointerdown=${this.#stopPropagation}
      @click=${this.#onAddClick}
      @dblclick=${this.#stopPropagation}
    >
      <jolly-icon name="plus"></jolly-icon>
    </button>`;
  }

  #stopPropagation(
    event: Event
  ): void {
    event.stopPropagation();
  }

  #onAddClick(
    event: MouseEvent
  ): void {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent(kBlockCreateEvent, {
      bubbles: false,
      composed: false
    }));
  }

  #renderUnused() {
    const grid = this._grid;
    if (grid === null || this.unused.size === 0) {
      return nothing;
    }

    return this.blocks.map((block, index) => {
      if (!this.unused.has(block.id)) {
        return nothing;
      }

      const rect = blockCellRect(index, grid, kCellInset);

      return html`<div
        class="unused"
        data-block-id=${block.id}
        style=${blockCellStyle(rect)}
      ></div>`;
    });
  }

  #renderProblems() {
    const grid = this._grid;
    if (grid === null || this.problems.size === 0) {
      return nothing;
    }

    return this.blocks.map((block, index) => {
      const problem = this.problems.get(block.id);
      if (problem === undefined) {
        return nothing;
      }

      const rect = blockCellRect(index, grid, kCellInset);

      return html`<div
        class="problem"
        title=${problem}
        style=${blockCellStyle(rect)}
      ></div>`;
    });
  }

  #renderInsertion() {
    const grid = this._grid;
    if (grid === null || this._insertAt === null) {
      return nothing;
    }

    const marker = blockInsertMarker(this._insertAt, grid);

    return html`<div
      class="insertion"
      style=${[
        `left:${marker.x}px`,
        `top:${marker.y}px`,
        `height:${marker.height}px`
      ].join(";")}
    ></div>`;
  }

  #renderOptions() {
    const grid = this._grid;
    if (grid === null) {
      return nothing;
    }

    return this.blocks.map((block, index) => html`<div
      class="option"
      role="option"
      aria-label=${block.name}
      aria-selected=${String(block.id === this.selectedId)}
      data-block-id=${block.id}
      style=${blockCellStyle(blockCellRect(index, grid, kCellInset))}
    ></div>`);
  }

  #renderHighlight(
    cell: MarkedCell
  ) {
    const { color } = cell.view.highlight;

    return html`<div
      class="highlight"
      style=${`${blockCellStyle(cell.rect)};border-color:${color}`}
    ></div>`;
  }

  #renderMarker(
    cell: MarkedCell
  ) {
    if (cell.view.dots.length === 0) {
      return nothing;
    }

    return html`<div
      class="marker"
      title=${peerMarkNames(cell.view)}
      style=${blockCellStyle(cell.rect)}
    >
      ${cell.view.dots.map((dot) => html`<span
        class="dot"
        style=${`background:${dot.color}`}
      ></span>`)}
    </div>`;
  }

  #markedCells(): MarkedCell[] {
    const grid = this._grid;
    if (grid === null) {
      return [];
    }

    const cells: MarkedCell[] = [];
    this.blocks.forEach((block, index) => {
      const view = resolvePeerMarks(this.marks.get(block.id));
      if (view === null) {
        return;
      }

      cells.push({
        rect: blockCellRect(index, grid, kCellInset),
        view
      });
    });

    return cells;
  }

  #build(): void {
    this.#renderer?.dispose();
    this.#renderer = new BlockLibraryRenderer(this._scroller, {
      shapeRegistry: this.engine.shapeRegistry,
      tilesetManager: this.engine.tilesetManager,
      materialGroups: this.engine.materialGroups,
      blocks: this.blocks
    });
    this.#renderer.onLayoutChange = () => this.#syncGrid();
    this.#renderer.onContextLost = () => {
      this.#build();
      this.#syncGrid();
    };
  }

  #syncGrid(): void {
    const grid = this.#renderer?.layout;
    if (grid === undefined) {
      return;
    }

    if (
      this._grid !== null &&
      this._grid.cols === grid.cols &&
      this._grid.cellSize === grid.cellSize
    ) {
      return;
    }

    this._grid = grid;
  }

  get #dragging(): boolean {
    return this.#drag?.dragging === true;
  }

  #onPointerDown(
    event: PointerEvent
  ): void {
    if (!this.reorderable || event.button !== 0 || this.#drag !== null) {
      return;
    }

    const blockId = this.#blockIdAt(event);
    if (blockId === null) {
      return;
    }

    this.#drag = {
      pointerId: event.pointerId,
      blockId,
      fromIndex: this.blocks.findIndex((block) => block.id === blockId),
      originX: event.clientX,
      originY: event.clientY,
      dragging: false
    };
    this._scroller.setPointerCapture(event.pointerId);
  }

  #onPointerMove(
    event: PointerEvent
  ): void {
    const drag = this.#drag;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return;
    }

    if (!drag.dragging) {
      const travelled = Math.hypot(
        event.clientX - drag.originX,
        event.clientY - drag.originY
      );
      if (travelled < kDragThreshold) {
        return;
      }

      this.#startDrag(drag);
    }

    event.preventDefault();
    this.#autoScroll(event);
    this._insertAt = this.#insertIndexAt(event);
  }

  #onPointerUp(
    event: PointerEvent
  ): void {
    const drag = this.#drag;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return;
    }

    const insertAt = drag.dragging ? this._insertAt : null;
    this.#suppressClick = drag.dragging;
    this.#endDrag();

    if (insertAt === null) {
      return;
    }

    const toIndex = blockMoveTargetIndex(
      drag.fromIndex,
      insertAt,
      this.blocks.length
    );
    if (toIndex === -1) {
      return;
    }

    this.dispatchEvent(new CustomEvent<BlockMoveDetail>(kBlockMoveEvent, {
      detail: {
        id: drag.blockId,
        toIndex
      },
      bubbles: false,
      composed: false
    }));
  }

  #onPointerCancel(
    event: PointerEvent
  ): void {
    if (this.#drag?.pointerId === event.pointerId) {
      this.#endDrag();
    }
  }

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key === "Escape") {
      this.#endDrag();
    }
  };

  #startDrag(
    drag: DragSession
  ): void {
    drag.dragging = true;
    window.addEventListener("keydown", this.#onKeyDown);
    this.requestUpdate();
  }

  #endDrag(): void {
    const drag = this.#drag;
    this.#drag = null;
    this._insertAt = null;
    if (drag === null) {
      return;
    }

    window.removeEventListener("keydown", this.#onKeyDown);
    if (this._scroller?.hasPointerCapture(drag.pointerId)) {
      this._scroller.releasePointerCapture(drag.pointerId);
    }
    this.requestUpdate();
  }

  #autoScroll(
    event: PointerEvent
  ): void {
    const scroller = this._scroller;
    const bounds = scroller.getBoundingClientRect();
    if (event.clientY < bounds.top + kAutoScrollMargin) {
      scroller.scrollTop -= kAutoScrollStep;
    }
    else if (event.clientY > bounds.bottom - kAutoScrollMargin) {
      scroller.scrollTop += kAutoScrollStep;
    }
  }

  #insertIndexAt(
    event: PointerEvent
  ): number | null {
    const grid = this._grid;
    const canvas = this.#renderer?.canvas;
    if (grid === null || canvas === undefined) {
      return null;
    }

    const bounds = canvas.getBoundingClientRect();

    return blockInsertIndex(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      grid,
      this.blocks.length
    );
  }

  #blockIdAt(
    event: MouseEvent
  ): number | null {
    const renderer = this.#renderer;
    if (!renderer) {
      return null;
    }

    const bounds = renderer.canvas.getBoundingClientRect();

    return renderer.getBlockAtPointer(
      event.clientX - bounds.left,
      event.clientY - bounds.top
    );
  }

  #onClick(
    event: MouseEvent
  ): void {
    if (this.#suppressClick) {
      this.#suppressClick = false;

      return;
    }

    this.#emitForPointer(
      kBlockSelectEvent,
      event
    );
  }

  #onDoubleClick(
    event: MouseEvent
  ): void {
    this.#emitForPointer(
      kBlockEditEvent,
      event
    );
  }

  #emitForPointer(
    name: string,
    event: MouseEvent
  ): void {
    const blockId = this.#blockIdAt(event);
    if (blockId === null) {
      return;
    }

    this.dispatchEvent(new CustomEvent<{ id: number; }>(name, {
      detail: { id: blockId },
      bubbles: false,
      composed: false
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-library-viewport": BlockLibraryViewport;
  }
}
