// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement, state } from "lit/decorators.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  TextureDialog,
  type TextureDialogFrame
} from "./TextureDialog.ts";

// CONSTANTS
const kMessage = "Make the texture transparent? " +
  "Pixels inside UV slots are kept unless the option below is checked.";
const kNoRegionsMessage = "Clear the entire texture and make every pixel transparent?";

export interface ClearTextureContext {
  hasUVRegions: boolean;
}

export interface ClearTextureResult {
  includeUV: boolean;
}

@customElement("clear-texture-dialog")
export class ClearTextureDialog extends TextureDialog<
  ClearTextureContext,
  "confirm",
  ClearTextureResult
> {
  @state()
  declare private hasUVRegions: boolean;

  @state()
  declare private includeUV: boolean;

  constructor() {
    super();
    this.hasUVRegions = false;
    this.includeUV = false;
  }

  protected get frame(): TextureDialogFrame<"confirm"> {
    return {
      heading: "Clear texture",
      icon: "clearTexture",
      intent: "danger",
      message: this.hasUVRegions ? kMessage : kNoRegionsMessage,
      actions: [
        {
          value: "confirm",
          label: "Clear",
          variant: "danger"
        }
      ],
      focus: "confirm"
    };
  }

  protected reset(
    context: ClearTextureContext
  ): void {
    this.hasUVRegions = context.hasUVRegions;
    this.includeUV = false;
  }

  protected result(): ClearTextureResult {
    return {
      includeUV: this.includeUV
    };
  }

  protected renderFields(): TemplateResult | typeof nothing {
    if (!this.hasUVRegions) {
      return nothing;
    }

    return html`
      <jolly-checkbox
        label="Also clear pixels inside UV slots"
        .value=${this.includeUV}
        @jolly-change=${this.#onIncludeUVChange}
      ></jolly-checkbox>
    `;
  }

  #onIncludeUVChange(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this.includeUV = event.detail.value;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "clear-texture-dialog": ClearTextureDialog;
  }
}
