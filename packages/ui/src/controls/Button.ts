// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { buttonStyles } from "./Button.styles.ts";
import type { IconName } from "../icon/registry.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

import "../icon/Icon.ts";

export interface ButtonDefaults {
  variant: ButtonVariant;
}

export type ButtonVariant =
  | "default"
  | "accent"
  | "success"
  | "danger";

export type ButtonType =
  | "button"
  | "submit";

@customElement("jolly-button")
export class Button extends LitElement {
  static readonly Defaults: ButtonDefaults = {
    variant: "default"
  };

  static override shadowRootOptions = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true
  };

  static override styles = [
    buttonStyles,
    hiddenStyles
  ];

  @property({ type: String })
  declare icon?: IconName;

  @property({ type: String, reflect: true })
  declare variant: ButtonVariant;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @property({ type: String })
  declare label: string;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "icon-only"
  })
  declare iconOnly: boolean;

  @property({ attribute: false })
  declare pressed?: boolean;

  @property({ type: String })
  declare type: ButtonType;

  constructor() {
    super();

    this.variant = Button.Defaults.variant;
    this.disabled = false;
    this.label = "";
    this.iconOnly = false;
    this.type = "button";
    this.addEventListener("click", () => {
      if (this.type === "submit" && !this.disabled) {
        this.closest("form")?.requestSubmit();
      }
    });
  }

  override render(): TemplateResult {
    return html`
      <button
        type="button"
        ?disabled=${this.disabled}
        aria-label=${this.label === "" ? nothing : this.label}
        aria-pressed=${this.pressed === undefined ? nothing : String(this.pressed)}
      >
        ${this.icon === undefined
          ? nothing
          : html`<jolly-icon name=${this.icon}></jolly-icon>`}
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-button": Button;
  }
}
