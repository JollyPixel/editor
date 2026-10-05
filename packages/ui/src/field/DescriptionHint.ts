// Import Third-party Dependencies
import {
  html,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import {
  createRef,
  ref
} from "lit/directives/ref.js";

// Import Internal Dependencies
import { PopoverController } from "./PopoverController.ts";
import {
  ensureModalityTracking,
  wasPointerInput
} from "./pointerModality.ts";

// Registers the information icon.
import "../icon/Icon.ts";

// CONSTANTS
let nextHintId = 0;

export type FieldDescriptionDisplay = "block" | "tooltip";

export class DescriptionHint {
  #id: string;
  #button = createRef<HTMLButtonElement>();
  #tooltip = createRef<HTMLElement>();
  #popup: PopoverController;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#id = `jolly-description-hint-${nextHintId++}`;
    ensureModalityTracking();
    this.#popup = new PopoverController(host, {
      anchor: () => this.#button.value ?? null,
      popover: () => this.#tooltip.value ?? null,
      side: "above",
      align: "center",
      openOnHover: {},
      closeOnHoverLeave: {
        delay: 0
      },
      claimsInput: false
    });
  }

  render(
    label: string,
    description: string
  ): TemplateResult {
    const name = label === "" ?
      "More information" :
      `More information about ${label}`;

    return html`
      <button
        ${ref(this.#button)}
        class="hint"
        type="button"
        aria-label=${name}
        aria-describedby=${this.#id}
        @click=${this.#show}
        @focus=${this.#onFocus}
        @blur=${this.#hide}
        @pointerenter=${this.#popup.onPointerEnter}
        @pointerleave=${this.#popup.onPointerLeave}
      ><jolly-icon name="info"></jolly-icon></button>
      <div
        ${ref(this.#tooltip)}
        class="hint-tooltip overlay-motion"
        id=${this.#id}
        popover="hint"
        role="tooltip"
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
      >${description}</div>
    `;
  }

  readonly #show = (): void => {
    if (!this.#popup.open) {
      this.#popup.show();
    }
  };

  readonly #hide = (): void => {
    if (this.#popup.open) {
      this.#popup.hide();
    }
  };

  readonly #onFocus = (): void => {
    if (!wasPointerInput()) {
      this.#show();
    }
  };
}
