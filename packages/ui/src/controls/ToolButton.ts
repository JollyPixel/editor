// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";

// Import Internal Dependencies
import { toolButtonStyles } from "./ToolButton.styles.ts";
import {
  isFlyoutAction,
  opensOnClick
} from "./toolButtonFlyout.ts";
import type { IconName } from "../icon/registry.ts";
import "../icon/Icon.ts";

export type ToolButtonFlyoutSide =
  | "above"
  | "below"
  | "left"
  | "right";

export interface ToolButtonDefaults {
  flyoutSide: ToolButtonFlyoutSide;
}

@customElement("jolly-tool-button")
export class ToolButton extends LitElement {
  static readonly Defaults: ToolButtonDefaults = {
    flyoutSide: "right"
  };

  static override styles = toolButtonStyles;

  @property({ type: String })
  declare icon?: IconName;

  @property({ type: String })
  declare label: string;

  @property({ type: Boolean, reflect: true })
  declare active: boolean;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @property({
    type: String,
    attribute: "flyout-side",
    reflect: true
  })
  declare flyoutSide: ToolButtonFlyoutSide;

  @property({ type: Boolean, reflect: true })
  declare open: boolean;

  @state()
  declare _hasFlyout: boolean;

  @query(".button")
  declare _button: HTMLButtonElement | null;

  @query(".flyout")
  declare _flyout: HTMLElement | null;

  #pointerType = "";
  #pressing = false;
  #hovering = false;

  constructor() {
    super();

    this.label = "";
    this.active = false;
    this.disabled = false;
    this.flyoutSide = ToolButton.Defaults.flyoutSide;
    this.open = false;
    this._hasFlyout = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener("pointerenter", this.#onPointerEnter);
    this.addEventListener("pointerleave", this.#onPointerLeave);
    this.addEventListener("focusout", this.#onFocusOut);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("pointerenter", this.#onPointerEnter);
    this.removeEventListener("pointerleave", this.#onPointerLeave);
    this.removeEventListener("focusout", this.#onFocusOut);
    this.removeEventListener("keydown", this.#onKeyDown);
    window.removeEventListener("pointerup", this.#onWindowPointerUp);
    this.open = false;

    super.disconnectedCallback();
  }

  override focus(
    options?: FocusOptions
  ): void {
    this._button?.focus(options);
  }

  show(): void {
    if (this._hasFlyout && !this.disabled) {
      this.open = true;
    }
  }

  hide(): void {
    this.open = false;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("disabled") && this.disabled) {
      this.open = false;
    }
  }

  override render(): TemplateResult {
    return html`
      <button
        class="button"
        part="button"
        type="button"
        ?disabled=${this.disabled}
        aria-label=${this.label === "" ? nothing : this.label}
        aria-pressed=${this._hasFlyout ? nothing : String(this.active)}
        aria-haspopup=${this._hasFlyout ? "true" : nothing}
        aria-expanded=${this._hasFlyout ? String(this.open) : nothing}
        @pointerdown=${this.#onButtonPointerDown}
        @click=${this.#onButtonClick}
      >
        ${this.icon === undefined ?
          nothing :
          html`<jolly-icon name=${this.icon}></jolly-icon>`}
        <slot></slot>
        ${this._hasFlyout ? html`<span class="notch" part="notch"></span>` : nothing}
      </button>
      ${this.label === "" ?
        nothing :
        html`<span class="tooltip" part="tooltip" aria-hidden="true">${this.label}</span>`}
      <div
        class="flyout"
        part="flyout"
        ?hidden=${!this._hasFlyout}
        @pointerdown=${this.#onFlyoutPointerDown}
        @click=${this.#onFlyoutClick}
      >
        <slot name="flyout" @slotchange=${this.#onFlyoutSlotChange}></slot>
      </div>
    `;
  }

  #onPointerEnter = (
    event: PointerEvent
  ): void => {
    this.#hovering = true;
    if (event.pointerType === "mouse") {
      this.show();
    }
  };

  #onPointerLeave = (): void => {
    this.#hovering = false;
    if (!this.#pressing) {
      this.hide();
    }
  };

  #onFocusOut = (
    event: FocusEvent
  ): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.contains(next)) {
      return;
    }
    if (!this.#hovering && !this.#pressing) {
      this.hide();
    }
  };

  #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key !== "Escape" || !this.open) {
      return;
    }

    event.stopPropagation();
    this.hide();
    this.focus();
  };

  #onWindowPointerUp = (): void => {
    this.#pressing = false;
    window.removeEventListener("pointerup", this.#onWindowPointerUp);
    if (!this.#hovering) {
      this.hide();
    }
  };

  #onButtonPointerDown(
    event: PointerEvent
  ): void {
    this.#pointerType = event.pointerType;
  }

  #onButtonClick(): void {
    const pointerType = this.#pointerType;
    this.#pointerType = "";
    if (!this._hasFlyout || !opensOnClick(pointerType)) {
      return;
    }

    if (this.open) {
      this.hide();
    }
    else {
      this.show();
    }
  }

  #onFlyoutPointerDown(): void {
    this.#pressing = true;
    window.addEventListener("pointerup", this.#onWindowPointerUp);
  }

  #onFlyoutClick(
    event: MouseEvent
  ): void {
    const flyout = this._flyout;
    if (flyout === null || !isFlyoutAction(event.composedPath(), flyout)) {
      return;
    }

    this.hide();
  }

  #onFlyoutSlotChange(
    event: Event
  ): void {
    const slot = event.target;
    if (slot instanceof HTMLSlotElement) {
      this._hasFlyout = slot.assignedElements().length > 0;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-tool-button": ToolButton;
  }
}
