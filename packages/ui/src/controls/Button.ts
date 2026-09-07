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

// Side-effect import: an icon only button renders a `jolly-icon`.
import "../icon/Icon.ts";

export interface ButtonDefaults {
  variant: ButtonVariant;
}

export type ButtonVariant =
  | "default"
  | "accent"
  | "danger";

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

  constructor() {
    super();

    this.variant = Button.Defaults.variant;
    this.disabled = false;
    this.label = "";
    this.iconOnly = false;
  }

  override render(): TemplateResult {
    return html`
      <button
        type="button"
        ?disabled=${this.disabled}
        aria-label=${this.label === "" ? nothing : this.label}
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
