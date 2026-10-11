// Import Third-party Dependencies
import { LitElement, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";
import { ResizeHandle } from "@jolly-pixel/resize-handle";
import {
  LocalStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { blockLibraryViewportStyles } from "./BlockLibraryViewport.styles.ts";
import { BlockLibraryRenderer } from "./BlockLibraryRenderer.ts";
import type { BlockRenderSources } from "../rendering/BlockRenderSources.ts";
import type {
  BlockGrid,
  BlockCell
} from "./BlockGrid.ts";
import {
  BlockReorderController,
  type BlockMoveDetail
} from "./BlockReorderController.ts";
import {
  PeerMarks,
  type PeerMarkView
} from "./PeerMarks.ts";
import type { BlockLibraryLayout } from "./BlockLibrary.ts";
import type { MaterialSwatch } from "../../materials/MaterialSwatch.ts";

// CONSTANTS
const kBlockSelectEvent = "block-select";
const kBlockEditEvent = "block-edit";
const kBlockMoveEvent = "block-move";
const kBlockCreateEvent = "block-create";
const kCellInset = 3;
const kMinHeight = 60;
const kMaxHeight = 1200;
const kHeightStorageKey = "voxel-map:block-library:height";

interface MarkedCell {
  cell: BlockCell;
  view: PeerMarkView;
}

@customElement("block-library-viewport")
export class BlockLibraryViewport extends LitElement {
  static override styles = blockLibraryViewportStyles;

  @property({ attribute: false })
  declare sources: BlockRenderSources;

  @property({ attribute: false })
  declare blocks: ResolvedBlockDefinition[];

  @property({ attribute: false })
  declare marks: PeerMarks<number>;

  @property({ attribute: false })
  declare selectedId: number | null;

  @property({ attribute: false })
  declare unused: ReadonlySet<number>;

  @property({ attribute: false })
  declare swatches: ReadonlyMap<number, MaterialSwatch>;

  @property({ type: Boolean })
  declare editable: boolean;

  @property({ type: Boolean })
  declare reorderable: boolean;

  @property({ type: String, reflect: true })
  declare layout: BlockLibraryLayout;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @property({ type: Boolean, reflect: true })
  declare sized: boolean;

  @state()
  private declare _grid: BlockGrid | null;

  @query(".scroller")
  declare private _scroller: HTMLDivElement;

  @query(".grip")
  declare private _grip: HTMLDivElement | null;

  #renderer: BlockLibraryRenderer | null = null;
  #shown = false;
  #visibilityObserver: IntersectionObserver | null = null;
  #resizeHandle: ResizeHandle | null = null;
  #reorder = new BlockReorderController(this, {
    scroller: () => this._scroller,
    blockAt: (clientX, clientY) => this.#blockIdAt(clientX, clientY),
    insertIndexAt: (clientX, clientY) => this.#insertIndexAt(clientX, clientY),
    blockIds: () => this.blocks.map((block) => block.id),
    onMove: (detail) => {
      this.dispatchEvent(new CustomEvent<BlockMoveDetail>(kBlockMoveEvent, {
        detail,
        bubbles: false,
        composed: false
      }));
    }
  });

  constructor() {
    super();
    this.blocks = [];
    this.marks = new PeerMarks();
    this.selectedId = null;
    this.unused = new Set();
    this.swatches = new Map();
    this.editable = true;
    this.reorderable = true;
    this.layout = "compact";
    this.storage = new LocalStorageAdapter();
    this.sized = false;
    this._grid = null;
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.requestUpdate();
    }
    this.#visibilityObserver = new IntersectionObserver(this.#onVisibility);
    this.#visibilityObserver.observe(this);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#stopWatchingVisibility();
    this.#shown = false;
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

    if (!this.#shown) {
      return;
    }
    if (this.#renderer !== null) {
      this.#renderer.selectedId = this.selectedId;
    }
    if (changed.has("sources") || this.#renderer === null) {
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

    const scrollTop = grid.cellAt(index).scrollTopToReveal({
      scrollTop: scroller.scrollTop,
      height: scroller.clientHeight
    });
    if (scrollTop !== null) {
      scroller.scrollTop = scrollTop;
    }
  }

  override render() {
    const cells = this.#markedCells();

    return html`<div
      class=${this.#reorder.dragging ? "scroller dragging" : "scroller"}
      role="listbox"
      aria-label="Blocks"
      @click=${this.#onClick}
      @dblclick=${this.#onDoubleClick}
      @pointerdown=${this.#onPointerDown}
      @pointermove=${this.#onPointerMove}
      @pointerleave=${this.#onPointerLeave}
    >
      <div class="layer highlights">
        ${cells.map((cell) => this.#renderHighlight(cell))}
      </div>
      <div class="layer options">
        ${this.#renderOptions()}
      </div>
      <div class="layer marks">
        ${this.#renderUnused()}
        ${this.#renderSwatches()}
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

  readonly #onVisibility = (
    entries: IntersectionObserverEntry[]
  ): void => {
    if (entries.at(-1)?.isIntersecting !== true) {
      return;
    }

    this.#shown = true;
    this.#stopWatchingVisibility();
    this.requestUpdate();
  };

  #stopWatchingVisibility(): void {
    this.#visibilityObserver?.disconnect();
    this.#visibilityObserver = null;
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
    if (grid === null || !this.editable || this.#reorder.dragging) {
      return nothing;
    }

    return html`<button
      type="button"
      class="add-cell"
      aria-label="Add block"
      title="Add block"
      style=${grid.cellAt(this.blocks.length, kCellInset).style}
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

      return html`<div
        class="unused"
        data-block-id=${block.id}
        style=${grid.cellAt(index, kCellInset).style}
      ></div>`;
    });
  }

  #renderSwatches() {
    const grid = this._grid;
    if (grid === null || this.swatches.size === 0) {
      return nothing;
    }

    return this.blocks.map((block, index) => {
      const swatch = this.swatches.get(block.id);
      if (swatch === undefined) {
        return nothing;
      }

      return html`<div
        class="material"
        data-block-id=${block.id}
        style=${grid.cellAt(index, kCellInset).style}
      ><span
        class=${swatch.glow === null ? "swatch" : "swatch glows"}
        style=${swatch.style}
      ></span></div>`;
    });
  }

  #renderInsertion() {
    const grid = this._grid;
    const insertAt = this.#reorder.insertAt;
    if (grid === null || insertAt === null) {
      return nothing;
    }

    const marker = grid.insertMarker(insertAt);

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
      style=${grid.cellAt(index, kCellInset).style}
    ></div>`);
  }

  #renderHighlight(
    cell: MarkedCell
  ) {
    const { color } = cell.view.highlight;

    return html`<div
      class="highlight"
      style=${`${cell.cell.style};border-color:${color}`}
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
      title=${cell.view.names}
      style=${cell.cell.style}
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
      const view = this.marks.createView(block.id);
      if (view === null) {
        return;
      }

      cells.push({
        cell: grid.cellAt(index, kCellInset),
        view
      });
    });

    return cells;
  }

  #build(): void {
    this.#renderer?.dispose();
    this.#renderer = new BlockLibraryRenderer(this._scroller, this.sources);
    this.#renderer.selectedId = this.selectedId;
    this.#renderer.setBlocks(this.blocks);
    this.#renderer.onLayoutChange = () => this.#syncGrid();
    this.#renderer.onContextLost = () => {
      this.#build();
      this.#syncGrid();
    };
  }

  #syncGrid(): void {
    const grid = this.#renderer?.grid;
    if (grid === undefined || this._grid?.equals(grid) === true) {
      return;
    }

    this._grid = grid;
  }

  #onPointerDown(
    event: PointerEvent
  ): void {
    if (this.reorderable) {
      this.#reorder.begin(event);
    }
  }

  #onPointerMove(
    event: PointerEvent
  ): void {
    if (this.#renderer !== null && !this.#reorder.dragging) {
      this.#renderer.hoveredId = this.#blockIdAt(event.clientX, event.clientY);
    }
  }

  #onPointerLeave(): void {
    if (this.#renderer !== null) {
      this.#renderer.hoveredId = null;
    }
  }

  #insertIndexAt(
    clientX: number,
    clientY: number
  ): number | null {
    const grid = this._grid;
    const canvas = this.#renderer?.canvas;
    if (grid === null || canvas === undefined) {
      return null;
    }

    const bounds = canvas.getBoundingClientRect();

    return grid.insertIndex(
      clientX - bounds.left,
      clientY - bounds.top,
      this.blocks.length
    );
  }

  #blockIdAt(
    clientX: number,
    clientY: number
  ): number | null {
    const renderer = this.#renderer;
    if (!renderer) {
      return null;
    }

    const bounds = renderer.canvas.getBoundingClientRect();

    return renderer.blockAt(
      clientX - bounds.left,
      clientY - bounds.top
    );
  }

  #onClick(
    event: MouseEvent
  ): void {
    if (this.#reorder.consumeClick()) {
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
    if (!this.editable) {
      return;
    }

    this.#emitForPointer(
      kBlockEditEvent,
      event
    );
  }

  #emitForPointer(
    name: string,
    event: MouseEvent
  ): void {
    const blockId = this.#blockIdAt(event.clientX, event.clientY);
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
