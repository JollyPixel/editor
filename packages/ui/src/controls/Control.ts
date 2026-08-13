// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { controlStyles } from "./Control.styles.ts";
import { PopoverController } from "../field/PopoverController.ts";

// Side-effect import: details use the shared information icon.
import "../icon/Icon.ts";

let nextDetailsId = 0;

/**
 * A declarative key hint inside `jolly-controls`.
 */
@customElement("jolly-control")
export class Control extends LitElement {
  static override styles = controlStyles;

  @property({ type: String })
  declare description: string;

  @property({ type: String })
  declare details: string;

  @query(".details-button")
  declare _detailsButton: HTMLButtonElement | null;

  @query(".details")
  declare _details: HTMLElement | null;

  #detailsId = `jolly-control-details-${nextDetailsId++}`;
  #pointerFocus = false;

  #popup = new PopoverController(this, {
    anchor: () => this._detailsButton,
    popover: () => this._details,
    side: "above",
    align: "center",
    onOpen: () => {
      this._details?.style.setProperty(
        "visibility",
        "visible"
      );
    }
  });

  constructor() {
    super();

    this.description = "";
    this.details = "";
    this.setAttribute("role", "listitem");
  }

  override render(): TemplateResult {
    return html`
      <div class="keys"><slot></slot></div>
      <span class="description">${this.description}</span>
      ${this.details === "" ? nothing : this.#renderDetails()}
    `;
  }

  #renderDetails(): TemplateResult {
    return html`
      <button
        class="details-button"
        type="button"
        aria-label=${`More information about ${this.description}`}
        aria-describedby=${this.#detailsId}
        aria-expanded=${this.#popup.open}
        aria-haspopup="true"
        @click=${this.#toggleDetails}
        @mouseenter=${this.#showDetails}
        @mouseleave=${this.#hideDetails}
        @pointerdown=${this.#onPointerDown}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
        @focus=${this.#onFocus}
        @blur=${this.#hideDetails}
      >
        <jolly-icon name="info"></jolly-icon>
      </button>
      <div
        class="details"
        id=${this.#detailsId}
        popover="auto"
        role="tooltip"
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
      >
        ${this.details}
      </div>
    `;
  }

  #showDetails(): void {
    if (!this.#popup.open) {
      const details = this._details;
      if (details === null) {
        return;
      }

      details.style.setProperty(
        "visibility",
        "hidden"
      );
      details.showPopover();
    }
  }

  #onPointerDown(): void {
    this.#pointerFocus = true;
  }

  #onPointerUp(): void {
    this.#pointerFocus = false;
  }

  #onFocus(): void {
    if (!this.#pointerFocus) {
      this.#showDetails();
    }
  }

  #hideDetails(): void {
    if (this.#popup.open) {
      this._details?.style.setProperty(
        "visibility",
        "hidden"
      );
      this.#popup.hide();
    }
  }

  #toggleDetails(): void {
    if (this.#popup.open) {
      this.#hideDetails();
    }
    else {
      this.#showDetails();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-control": Control;
  }
}
