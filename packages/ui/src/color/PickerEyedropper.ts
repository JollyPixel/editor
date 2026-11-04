// Import Third-party Dependencies
import type { RGBA } from "@jolly-pixel/color";
import {
  html,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import { parseFieldColor } from "./draft.ts";

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperApi {
  open(): Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperApi;
  }
}

export interface PickerEyedropperOptions {
  enabled: () => boolean;
  editable: () => boolean;
  pick: (color: RGBA) => void;
}

export class PickerEyedropper {
  readonly #options: PickerEyedropperOptions;

  constructor(
    options: PickerEyedropperOptions
  ) {
    this.#options = options;
  }

  get shown(): boolean {
    return this.#options.enabled() && window.EyeDropper !== undefined;
  }

  render(): TemplateResult {
    return html`
      <button
        class="eyedropper"
        type="button"
        title="Pick a color from the screen"
        aria-label="Pick a color from the screen"
        ?disabled=${!this.#options.editable()}
        @click=${this.#open}
      ><jolly-icon name="eyedropper"></jolly-icon></button>
    `;
  }

  readonly #open = async(): Promise<void> => {
    const EyeDropper = window.EyeDropper;
    if (EyeDropper === undefined || !this.#options.editable()) {
      return;
    }

    const picked = await new EyeDropper().open().catch(() => null);
    const color = picked === null ? null : parseFieldColor(picked.sRGBHex);
    if (color !== null) {
      this.#options.pick(color);
    }
  };
}
