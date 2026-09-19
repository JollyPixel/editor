// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import { property, state } from "lit/decorators.js";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";
import type {
  PixelArtCanvas,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kTextureSizeValues = [16, 32, 64, 128, 256, 512, 1024, 2048];
const kTextureSizeOptions: JollyOption<number>[] = kTextureSizeValues.map((value) => {
  return { value, label: String(value) };
});

export class BuildTab extends LitElement {
  @property({ attribute: false })
  declare canvas: PixelArtCanvas | null;

  @state()
  private declare textureSize: Vec2;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      gap: var(--jolly-row-gap, 4px);
    }

    :host([hidden]) {
      display: none;
    }

    section {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    jolly-property-row jolly-select {
      flex: 1 1 0;
      min-width: 0;

      --jolly-field-inset-end: 0;
    }

    .separator {
      color: var(--jolly-text-muted);
    }
  `;

  #onTextureResized = (
    event: { size: Vec2; }
  ): void => {
    this.textureSize = { ...event.size };
  };

  constructor() {
    super();
    this.canvas = null;
    this.textureSize = { x: 64, y: 64 };
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (!changedProperties.has("canvas")) {
      return;
    }

    const previous = changedProperties.get("canvas");
    previous?.document.off("resized", this.#onTextureResized);
    previous?.document.off("replaced", this.#onTextureResized);

    if (this.canvas) {
      this.canvas.document.on("resized", this.#onTextureResized);
      this.canvas.document.on("replaced", this.#onTextureResized);
      this.textureSize = { ...this.canvas.textureSize };
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.canvas?.document.off("resized", this.#onTextureResized);
    this.canvas?.document.off("replaced", this.#onTextureResized);
  }

  #resizeTexture(
    axis: keyof Vec2,
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    if (!this.canvas) {
      return;
    }

    this.textureSize = {
      ...this.textureSize,
      [axis]: event.detail.value
    };
    this.canvas.textureSize = this.textureSize;
  }

  override render(): TemplateResult {
    return html`
      <section id="texture">
        <jolly-property-row label="Texture">
          <jolly-select
            title="Width"
            .options=${kTextureSizeOptions}
            .value=${this.textureSize.x}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
              this.#resizeTexture("x", event);
            }}
          ></jolly-select>
          <span class="separator">×</span>
          <jolly-select
            title="Height"
            .options=${kTextureSizeOptions}
            .value=${this.textureSize.y}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
              this.#resizeTexture("y", event);
            }}
          ></jolly-select>
        </jolly-property-row>
      </section>
    `;
  }
}

customElements.define("jolly-model-editor-build", BuildTab);
