// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement, state } from "lit/decorators.js";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  TextureDialog,
  type TextureDialogFrame
} from "./TextureDialog.ts";

// CONSTANTS
const kDefaultUvSize = 16;
const kUvSizes: readonly number[] = [16, 32, 64, 128, 256];

export type ImportTextureChoice = "replace" | "add";

export interface ImportTextureContext {
  name: string;
  size: Vec2;
}

export interface ImportTextureResult {
  choice: ImportTextureChoice;
  uvSize: number | null;
}

@customElement("import-texture-dialog")
export class ImportTextureDialog extends TextureDialog<
  ImportTextureContext,
  ImportTextureChoice,
  ImportTextureResult
> {
  @state()
  declare private name: string;

  @state()
  declare private sizes: JollyOption<number>[];

  @state()
  declare private uvSize: number | null;

  constructor() {
    super();
    this.name = "";
    this.sizes = [];
    this.uvSize = null;
  }

  protected get frame(): TextureDialogFrame<ImportTextureChoice> {
    return {
      heading: "Import texture",
      icon: "import",
      message: `Replace the current texture with "${this.name}", ` +
        "or add it as a new texture?",
      actions: [
        {
          value: "replace",
          label: "Replace current",
          variant: "default"
        },
        {
          value: "add",
          label: "Add as new",
          variant: "accent"
        }
      ],
      focus: "add"
    };
  }

  protected reset(
    context: ImportTextureContext
  ): void {
    const maxSize = Math.min(context.size.x, context.size.y);

    this.name = context.name;
    this.sizes = kUvSizes.map((size) => {
      return {
        value: size,
        label: `${size} × ${size}`,
        disabled: size > maxSize
      };
    });
    this.uvSize = kDefaultUvSize <= maxSize ? kDefaultUvSize : null;
  }

  protected result(
    choice: ImportTextureChoice
  ): ImportTextureResult {
    return {
      choice,
      uvSize: this.uvSize
    };
  }

  protected renderFields(): TemplateResult | typeof nothing {
    if (this.uvSize === null) {
      return nothing;
    }

    return html`
      <jolly-select
        part="import-uv-size"
        label="UV size of a new texture"
        .options=${this.sizes}
        .value=${this.uvSize}
        @jolly-change=${this.#onUvSizeChange}
      ></jolly-select>
    `;
  }

  #onUvSizeChange(
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    this.uvSize = event.detail.value;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "import-texture-dialog": ImportTextureDialog;
  }
}
