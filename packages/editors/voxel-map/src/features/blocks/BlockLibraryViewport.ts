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
const kCellInset = 3;

interface MarkedCell {
  rect: BlockCellRect;
  view: PeerMarkView;
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

  @query(".scroller")
  declare private _scroller: HTMLDivElement;

  #renderer: BlockLibraryRenderer | null = null;

  constructor() {
    super();
    this.engine = undefined;
    this.blocks = [];
    this.marks = new Map();
    this.layout = "compact";
    this._grid = null;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
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
      class="scroller"
      @click=${this.#onClick}
      @dblclick=${this.#onDoubleClick}
    >
      <div class="layer highlights">
        ${cells.map((cell) => this.#renderHighlight(cell))}
      </div>
      <div class="layer marks">
        ${cells.map((cell) => this.#renderMarker(cell))}
      </div>
    </div>`;
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

  #onClick(
    event: MouseEvent
  ): void {
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
    if (!this.#renderer) {
      return;
    }

    const rect = this.#renderer.canvas.getBoundingClientRect();
    const blockId = this.#renderer.getBlockAtPointer(
      event.clientX - rect.left,
      event.clientY - rect.top
    );
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
