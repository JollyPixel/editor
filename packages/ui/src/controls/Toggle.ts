// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import { BooleanField } from "../field/BooleanField.ts";
import { toggleStyles } from "./Toggle.styles.ts";
import { revealOverflowTitle } from "../interaction/overflowTitle.ts";

@customElement("jolly-toggle")
export class Toggle extends BooleanField {
  static override styles = [
    ...BooleanField.styles,
    toggleStyles
  ];

  protected override get hasLabelColumn(): boolean {
    return false;
  }

  protected renderValue(): TemplateResult {
    return html`
      <label class="toggle">
        <span
          class="text"
          @pointerenter=${revealOverflowTitle}
        >${this.label}</span>
        ${this.renderInput()}
        <span class="switch" aria-hidden="true"></span>
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-toggle": Toggle;
  }
}
