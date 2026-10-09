// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  property,
  query
} from "lit/decorators.js";
import {
  FieldBinding,
  SubscriptionController,
  type JollyOption
} from "@jolly-pixel/ui";
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

// Import Internal Dependencies
import "../features/transform/TransformPanel.ts";
import type { TransformPanel } from "../features/transform/TransformPanel.ts";
import type { TransformWorkspace } from "../features/transform/TransformPanelController.ts";

// CONSTANTS
const kTextureSizeValues = [
  16, 32, 64, 128, 256, 512, 1024, 2048
];
const kUvActions: ReadonlySet<VoxelModelCommandAction> = new Set([
  "node-added",
  "node-removed",
  "node-uv-changed"
]);
const kDefaultTextureSize: Vec2 = {
  x: 64,
  y: 64
};

interface BuildSources {
  canvas: PixelArtCanvas | null;
  model: ModelDocument | null;
}

export interface BuildWorkspace extends TransformWorkspace {
  document: ModelDocument;
}

export class BuildTab extends LitElement {
  @property({ attribute: false })
  declare canvas: PixelArtCanvas | null;

  @property({ attribute: false })
  declare workspace: BuildWorkspace | null;

  @query("jolly-model-editor-transform")
  declare private transformElement: TransformPanel;

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

    jolly-folder[key="transform"]::part(header) {
      font-size: calc(var(--jolly-font-size, 11px) + 2px);
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

  #sources = new SubscriptionController<BuildSources>(
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
    const blocks = this.workspace?.document.tree.blocks() ?? [];
    this.#extent = new BlockUvLayouts([...blocks].map((block) => block.uv)).extent;
    this.requestUpdate();
  };

  constructor() {
    super();
    this.canvas = null;
    this.workspace = null;
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (
      changedProperties.has("canvas") ||
      changedProperties.has("workspace")
    ) {
      this.#remeasure();
      this.#sources.attach({
        canvas: this.canvas,
        model: this.workspace?.document ?? null
      });
    }
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("workspace") && this.workspace !== null) {
      this.transformElement.attach(this.workspace);
    }
  }

  override render(): TemplateResult {
    const extent = this.#extent;

    return html`
      <jolly-folder
        key="transform"
        label="Transform"
        .collapsible=${false}
        flush
      >
        <jolly-model-editor-transform></jolly-model-editor-transform>
      </jolly-folder>
      <section id="texture">
        <jolly-property-row label="Texture">
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
      </section>
    `;
  }

  #subscribeTo(
    sources: BuildSources
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

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-build": BuildTab;
  }
}
