// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import type {
  VoxelEngine,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockPreviewRenderer } from "./BlockPreviewRenderer.ts";

@customElement("block-shape-preview")
export class BlockShapePreview extends LitElement {
  static override styles = css`
    :host {
      display: block;
      aspect-ratio: 1;
    }

    .well {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--jolly-well-bg, #0e1316);
      border-radius: var(--jolly-radius-sm, 3px);
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine;

  @property({ attribute: false })
  declare block: ResolvedBlockDefinition | null;

  @query(".well")
  declare private _well: HTMLDivElement;

  #renderer: BlockPreviewRenderer | null = null;

  constructor() {
    super();
    this.block = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.#build();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#renderer?.dispose();
    this.#renderer = null;
  }

  override render() {
    return html`<div class="well"></div>`;
  }

  override updated(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("engine") || this.#renderer === null) {
      this.#build();
    }
    else if (changed.has("block")) {
      this.#renderer.block = this.block;
    }
  }

  #build(): void {
    this.#renderer?.dispose();
    this.#renderer = null;
    if (!this._well) {
      return;
    }

    this.#renderer = new BlockPreviewRenderer(this._well, {
      shapeRegistry: this.engine.shapeRegistry,
      tilesetManager: this.engine.tilesetManager
    });
    this.#renderer.block = this.block;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-shape-preview": BlockShapePreview;
  }
}
