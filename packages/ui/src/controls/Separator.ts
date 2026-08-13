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
import { separatorStyles } from "./Separator.styles.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

/**
 * Optional captioned divider between control groups.
 */
@customElement("jolly-separator")
export class Separator extends LitElement {
  static override styles = [
    separatorStyles,
    hiddenStyles
  ];

  /**
   * Caption for the divider; absent captions make it decorative.
   */
  @property({ type: String })
  declare label: string;

  constructor() {
    super();

    this.label = "";
  }

  override render(): TemplateResult {
    if (this.label === "") {
      return html`
        <div class="unlabelled" role="separator">
          <span class="rule" aria-hidden="true"></span>
        </div>
      `;
    }

    return html`
      <div class="labelled" role="separator" aria-label=${this.label}>
        <span class="rule" aria-hidden="true"></span>
        <span class="caption">${this.label}</span>
        <span class="rule" aria-hidden="true"></span>
      </div>
      ${nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-separator": Separator;
  }
}
