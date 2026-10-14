// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { BooleanField } from "../field/BooleanField.ts";
import { checkboxStyles } from "./Checkbox.styles.ts";

/**
 * Wraps a native checkbox and its indeterminate state.
 */
@customElement("jolly-checkbox")
export class Checkbox extends BooleanField {
  static override styles = [
    ...BooleanField.styles,
    checkboxStyles
  ];

  /**
   * Expands the native label across the value background.
   */
  @property({ type: Boolean, attribute: "clickable-background", reflect: true })
  declare clickableBackground: boolean;

  constructor() {
    super();

    this.clickableBackground = false;
  }

  /**
   * Keeps the native checkbox on the standard control-sized hit target.
   */
  protected renderValue(): TemplateResult {
    return html`
      <label class="checkbox">${this.renderInput()}</label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-checkbox": Checkbox;
  }
}
