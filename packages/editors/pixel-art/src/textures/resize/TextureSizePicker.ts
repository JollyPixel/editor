// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import {
  FieldBinding,
  SubscriptionController
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/select";
import type {
  PixelArtCanvas,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TextureSizeChoices } from "./TextureSizeChoices.ts";

@customElement("texture-size-picker")
export class TextureSizePicker extends LitElement {
  @property({ attribute: false })
  declare canvas: PixelArtCanvas | null;

  @property({ type: Boolean })
  declare disabled: boolean;

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    jolly-select {
      width: 7ch;

      --jolly-field-inset-end: 0px;
    }

    .separator {
      color: var(--color-text-muted);
    }
  `;

  #width = this.#axisBinding("x");
  #height = this.#axisBinding("y");
  #sources = new SubscriptionController<PixelArtCanvas | null>(
    this,
    (canvas) => (canvas === null ? [] : this.#subscribeTo(canvas))
  );

  #refresh = (): void => {
    this.requestUpdate();
  };

  constructor() {
    super();
    this.canvas = null;
    this.disabled = false;
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("canvas")) {
      this.#sources.attach(this.canvas);
    }
  }

  override render(): TemplateResult | typeof nothing {
    const { canvas } = this;
    if (canvas === null) {
      return nothing;
    }

    const choices = new TextureSizeChoices(
      canvas.uv.regions,
      canvas.maxTextureSize,
      canvas.textureSize
    );

    return html`
      <jolly-select
        title="Texture width"
        ?disabled=${this.disabled}
        .options=${choices.axis("x")}
        .value=${this.#width.value}
        @jolly-change=${this.#width.commit}
      ></jolly-select>
      <span class="separator">×</span>
      <jolly-select
        title="Texture height"
        ?disabled=${this.disabled}
        .options=${choices.axis("y")}
        .value=${this.#height.value}
        @jolly-change=${this.#height.commit}
      ></jolly-select>
    `;
  }

  #subscribeTo(
    canvas: PixelArtCanvas
  ): Array<() => void> {
    const { document, uv } = canvas;
    document.on("resized", this.#refresh);
    document.on("replaced", this.#refresh);
    uv.on("changed", this.#refresh);

    return [
      () => document.off("resized", this.#refresh),
      () => document.off("replaced", this.#refresh),
      () => uv.off("changed", this.#refresh)
    ];
  }

  #axisBinding(
    axis: keyof Vec2
  ): FieldBinding<number> {
    return new FieldBinding<number>(this, {
      read: () => this.canvas?.textureSize[axis] ?? 0,
      write: (value) => {
        const { canvas } = this;
        if (canvas === null || value === canvas.textureSize[axis]) {
          return;
        }

        canvas.textureSize = {
          ...canvas.textureSize,
          [axis]: value
        };
      }
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "texture-size-picker": TextureSizePicker;
  }
}
