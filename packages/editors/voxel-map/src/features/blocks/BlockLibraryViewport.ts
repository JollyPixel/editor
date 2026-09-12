// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type {
  VoxelEngine,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockLibraryRenderer } from "./BlockLibraryRenderer.ts";
import {
  blockCellRect,
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
const kCellInset = 3;
const kDragThreshold = 4;
const kAutoScrollMargin = 24;
const kAutoScrollStep = 10;

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
  static override styles = css`
    :host {
      display: block;

      --block-grid-inset: 5px;
    }

    .scroller {
      position: relative;
      overflow-x: hidden;
      overflow-y: auto;
      scrollbar-gutter: stable;
      min-height: 100px;
      max-height: 240px;
      padding: var(--block-grid-inset);
      background: var(--jolly-well-bg, #0e1316);
      border-radius: var(--jolly-radius-sm, 3px);
      cursor: pointer;
    }

    .scroller > canvas {
      position: relative;
      z-index: 1;
    }

    .layer {
      position: absolute;
      inset-block-start: var(--block-grid-inset);
      inset-inline-start: var(--block-grid-inset);
      width: 0;
      height: 0;
      pointer-events: none;
    }

    .layer.highlights {
      z-index: 0;
    }

    .layer.marks {
      z-index: 2;
    }

    .layer.drop {
      z-index: 3;
    }

    .insertion {
      position: absolute;
      width: 2px;
      margin-inline-start: -1px;
      border-radius: 1px;
      background: var(--jolly-accent, #4c9aff);
      box-shadow: 0 0 0 1px var(--jolly-well-bg, #0e1316);
    }

    .scroller.dragging {
      cursor: grabbing;
    }

    .scroller.dragging > canvas {
      opacity: 0.75;
    }

    .highlight {
      position: absolute;
      border-radius: var(--jolly-radius-sm, 4px);
      box-sizing: border-box;
      border: 2px dashed transparent;
    }

    .marker {
      position: absolute;
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      gap: 2px;
      padding: 4px;
      box-sizing: border-box;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      box-shadow: 0 0 0 1px var(--jolly-well-bg, #0e1316);
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare blocks: ResolvedBlockDefinition[];

  @property({ attribute: false })
  declare marks: PeerMarkMap<number>;

  @property({ type: String, reflect: true })
  declare layout: BlockLibraryLayout;

  @state()
  private declare _grid: BlockGridLayout | null;

  @state()
  private declare _insertAt: number | null;

  @query(".scroller")
  declare private _scroller: HTMLDivElement;

  #renderer: BlockLibraryRenderer | null = null;
  #drag: DragSession | null = null;
  #suppressClick = false;

  constructor() {
    super();
    this.engine = undefined;
    this.blocks = [];
    this.marks = new Map();
    this.layout = "compact";
    this._grid = null;
    this._insertAt = null;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#endDrag();
    this.#renderer?.dispose();
    this.#renderer = null;
  }

  override updated(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("engine")) {
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
      <div class="layer marks">
        ${cells.map((cell) => this.#renderMarker(cell))}
      </div>
      <div class="layer drop">
        ${this.#renderInsertion()}
      </div>
    </div>`;
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

  #renderHighlight(
    cell: MarkedCell
  ) {
    const { color } = cell.view.highlight;

    return html`<div
      class="highlight"
      style=${[
        `left:${cell.rect.x}px`,
        `top:${cell.rect.y}px`,
        `width:${cell.rect.size}px`,
        `height:${cell.rect.size}px`,
        `border-color:${color}`
      ].join(";")}
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
      style=${[
        `left:${cell.rect.x}px`,
        `top:${cell.rect.y}px`,
        `width:${cell.rect.size}px`,
        `height:${cell.rect.size}px`
      ].join(";")}
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
    if (!this.engine) {
      return;
    }

    this.#renderer?.dispose();
    this.#renderer = new BlockLibraryRenderer(this._scroller, {
      shapeRegistry: this.engine.shapeRegistry,
      tilesetManager: this.engine.tilesetManager,
      blocks: this.blocks
    });
    this.#renderer.onLayoutChange = () => this.#syncGrid();
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
    if (event.button !== 0 || this.#drag !== null) {
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
