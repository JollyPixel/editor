// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import type {
  VoxelRenderer,
  BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockLibraryRenderer } from "./BlockLibraryRenderer.ts";

// CONSTANTS
const kBlockSelectEvent = "block-select";
const kBlockEditEvent = "block-edit";

/** Three.js block preview grid with pointer picking. */
@customElement("block-library-viewport")
export class BlockLibraryViewport extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .scroller {
      overflow-x: hidden;
      overflow-y: auto;
      min-height: 100px;
      max-height: 240px;
      padding: 5px;
      background: var(--jolly-well-bg, #0e1316);
      border-radius: var(--jolly-radius-sm, 3px);
      cursor: pointer;
    }
  `;

  @property({ attribute: false })
  declare vr: VoxelRenderer | undefined;
  @property({ attribute: false })
  declare blocks: BlockDefinition[];
  @property({ attribute: false })
  declare selectedId: number | null;

  @query(".scroller")
  declare private _scroller: HTMLDivElement;

  #renderer: BlockLibraryRenderer | null = null;

  constructor() {
    super();
    this.blocks = [];
    this.selectedId = null;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#renderer?.dispose();
    this.#renderer = null;
  }

  override updated(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("vr")) {
      this.#build();

      return;
    }

    if (changed.has("blocks")) {
      this.#renderer?.setBlocks(this.blocks);
    }
    if (changed.has("selectedId")) {
      this.#renderer?.setSelectedBlock(this.selectedId);
    }
  }

  override render() {
    return html`<div
      class="scroller"
      @click=${this.#onClick}
      @dblclick=${this.#onDoubleClick}
    ></div>`;
  }

  #build(): void {
    if (!this.vr) {
      return;
    }

    this.#renderer?.dispose();
    this.#renderer = new BlockLibraryRenderer(this._scroller, {
      shapeRegistry: this.vr.engine.shapeRegistry,
      tilesetManager: this.vr.engine.tilesetManager,
      blocks: this.blocks
    });
    this.#renderer.setSelectedBlock(this.selectedId);
  }

  #onClick(
    event: MouseEvent
  ): void {
    this.#emitForPointer(kBlockSelectEvent, event);
  }

  #onDoubleClick(
    event: MouseEvent
  ): void {
    this.#emitForPointer(kBlockEditEvent, event);
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
