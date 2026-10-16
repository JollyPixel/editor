// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "./BlockRenderSources.ts";
import { BlockPreviewSubject } from "./BlockPreviewSubject.ts";
import { SquareTurntable } from "../../preview/SquareTurntable.ts";
import type { PreviewStage } from "../../preview/PreviewStage.ts";
import { previewWellStyles } from "../../../shared/styles/previewWell.styles.ts";

@customElement("block-shape-preview")
export class BlockShapePreview extends LitElement {
  static override styles = [
    previewWellStyles,
    css`
      :host {
        display: block;
        aspect-ratio: 1;
        contain: size;
      }

      .well {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }
    `
  ];

  @property({ attribute: false })
  declare stage: PreviewStage;

  @property({ attribute: false })
  declare sources: BlockRenderSources;

  @property({ attribute: false })
  declare block: ResolvedBlockDefinition | null;

  @query(".well")
  declare private _well: HTMLDivElement;

  #renderer: SquareTurntable<BlockPreviewSubject> | null = null;

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
    if (
      changed.has("stage") ||
      changed.has("sources") ||
      this.#renderer === null
    ) {
      this.#build();
    }
    else if (changed.has("block")) {
      this.#renderer.subject.block = this.block;
    }
  }

  #build(): void {
    this.#renderer?.dispose();
    this.#renderer = null;
    if (!this._well) {
      return;
    }

    const subject = new BlockPreviewSubject(this.sources);
    subject.block = this.block;
    this.#renderer = new SquareTurntable(this._well, this.stage, subject);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-shape-preview": BlockShapePreview;
  }
}
