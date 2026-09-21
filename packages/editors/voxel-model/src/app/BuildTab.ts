// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import { property } from "lit/decorators.js";
import {
  FieldBinding,
  type JollyOption
} from "@jolly-pixel/ui";
import type {
  PixelArtCanvas,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kTextureSizeValues = [
  16, 32, 64, 128, 256, 512, 1024, 2048
];
const kTextureSizeOptions: JollyOption<number>[] = kTextureSizeValues.map((value) => {
  return {
    value,
    label: String(value)
  };
});
const kDefaultTextureSize: Vec2 = {
  x: 64,
  y: 64
};

export class BuildTab extends LitElement {
  @property({ attribute: false })
  declare canvas: PixelArtCanvas | null;

  #width = textureAxisBinding(this, "x");
  #height = textureAxisBinding(this, "y");

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

  #onTextureResized = (): void => {
    this.requestUpdate();
  };

  constructor() {
    super();
    this.canvas = null;
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
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.canvas?.document.off("resized", this.#onTextureResized);
    this.canvas?.document.off("replaced", this.#onTextureResized);
  }

  override render(): TemplateResult {
    return html`
      <section id="texture">
        <jolly-property-row label="Texture">
          <jolly-select
            title="Width"
            .options=${kTextureSizeOptions}
            .value=${this.#width.value}
            @jolly-change=${this.#width.commit}
          ></jolly-select>
          <span class="separator">×</span>
          <jolly-select
            title="Height"
            .options=${kTextureSizeOptions}
            .value=${this.#height.value}
            @jolly-change=${this.#height.commit}
          ></jolly-select>
        </jolly-property-row>
      </section>
    `;
  }
}

function textureAxisBinding(
  host: BuildTab,
  axis: keyof Vec2
): FieldBinding<number> {
  return new FieldBinding<number>(host, {
    read: () => (host.canvas?.textureSize ?? kDefaultTextureSize)[axis],
    write: (value) => {
      const { canvas } = host;
      if (canvas === null) {
        return;
      }

      canvas.textureSize = {
        ...canvas.textureSize,
        [axis]: value
      };
    }
  });
}

customElements.define("jolly-model-editor-build", BuildTab);
