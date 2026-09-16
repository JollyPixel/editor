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
import { spinnerStyles } from "./Spinner.styles.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

@customElement("jolly-spinner")
export class Spinner extends LitElement {
  static override styles = [
    spinnerStyles,
    hiddenStyles
  ];

  @property({ type: String })
  declare label: string;

  constructor() {
    super();
    this.label = "";
  }

  override render(): TemplateResult {
    const labelled = this.label !== "";

    return html`
      <div
        class="spinner"
        part="spinner"
        role=${labelled ? "status" : nothing}
        aria-label=${labelled ? this.label : nothing}
        aria-hidden=${labelled ? nothing : "true"}
      ></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-spinner": Spinner;
  }
}
