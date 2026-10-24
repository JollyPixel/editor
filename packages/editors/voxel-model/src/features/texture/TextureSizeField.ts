// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  FieldBinding,
  SubscriptionController,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/property-row";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/separator";
import type {
  PixelArtCanvas,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  BlockUvLayouts,
  type ModelChange,
  type ModelDocument,
  type VoxelModelCommandAction
} from "@jolly-pixel/asset.voxel-model/client";

// CONSTANTS
const kTextureSizeValues = [
  16, 32, 64, 128, 256, 512, 1024, 2048
];
const kUvActions: ReadonlySet<VoxelModelCommandAction> = new Set([
  "node-added",
  "node-removed",
  "node-uv-changed",
  "node-shape-changed"
]);
const kDefaultTextureSize: Vec2 = {
  x: 64,
  y: 64
};

interface TextureSizeSources {
  canvas: PixelArtCanvas | null;
  model: ModelDocument | null;
}

export class TextureSizeField extends LitElement {
  static override properties = {
    canvas: { attribute: false },
    model: { attribute: false }
  };

  declare canvas: PixelArtCanvas | null;
  declare model: ModelDocument | null;

  #width = textureAxisBinding(this, "x");
  #height = textureAxisBinding(this, "y");

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);

      --jolly-label-width: 10ch;
    }

    :host([hidden]) {
      display: none;
    }

    jolly-property-row jolly-select {
      flex: 1 1 0;
      min-width: 0;

      --jolly-field-inset-end: 0px;
    }

    .separator {
      color: var(--jolly-text-muted);
    }
  `;

  #sources = new SubscriptionController<TextureSizeSources>(
    this,
    (sources) => this.#subscribeTo(sources)
  );
  #extent: Vec2 = {
    x: 0,
    y: 0
  };

  #refresh = (): void => {
    this.requestUpdate();
  };

  #onModelChange = (
    change: ModelChange
  ): void => {
    if (kUvActions.has(change.command.action)) {
      this.#remeasure();
    }
  };

  #remeasure = (): void => {
    const blocks = this.model?.tree.blocks() ?? [];
    this.#extent = new BlockUvLayouts([...blocks].map((block) => block.uv)).extent;
    this.requestUpdate();
  };

  constructor() {
    super();
    this.canvas = null;
    this.model = null;
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (
      changedProperties.has("canvas") ||
      changedProperties.has("model")
    ) {
      this.#remeasure();
      this.#sources.attach({
        canvas: this.canvas,
        model: this.model
      });
    }
  }

  override render(): TemplateResult {
    const extent = this.#extent;

    return html`
      <jolly-separator label="Texture"></jolly-separator>
      <jolly-property-row label="Size">
        <jolly-select
          title="Width"
          .options=${sizeOptions(extent.x)}
          .value=${this.#width.value}
          @jolly-change=${this.#width.commit}
        ></jolly-select>
        <span class="separator">×</span>
        <jolly-select
          title="Height"
          .options=${sizeOptions(extent.y)}
          .value=${this.#height.value}
          @jolly-change=${this.#height.commit}
        ></jolly-select>
      </jolly-property-row>
    `;
  }

  #subscribeTo(
    sources: TextureSizeSources
  ): Array<() => void> {
    const subscriptions: Array<() => void> = [];
    const pixels = sources.canvas?.document;
    if (pixels) {
      pixels.on("resized", this.#refresh);
      pixels.on("replaced", this.#refresh);
      subscriptions.push(
        () => pixels.off("resized", this.#refresh),
        () => pixels.off("replaced", this.#refresh)
      );
    }

    const { model } = sources;
    if (model) {
      model.on("change", this.#onModelChange);
      model.on("reset", this.#remeasure);
      subscriptions.push(
        () => model.off("change", this.#onModelChange),
        () => model.off("reset", this.#remeasure)
      );
    }

    return subscriptions;
  }
}

function sizeOptions(
  minimum: number
): JollyOption<number>[] {
  return kTextureSizeValues.map((value) => {
    return {
      value,
      label: String(value),
      disabled: value < minimum
    };
  });
}

function textureAxisBinding(
  host: TextureSizeField,
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

customElements.define("jolly-model-editor-texture-size", TextureSizeField);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-texture-size": TextureSizeField;
  }
}
