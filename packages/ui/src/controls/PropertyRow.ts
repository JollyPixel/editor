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
import { propertyRowStyles } from "./PropertyRow.styles.ts";

// Registers the icon used by descriptions.
import "../icon/Icon.ts";

/**
 * Field-aligned layout for custom content.
 */
@customElement("jolly-property-row")
export class PropertyRow extends LitElement {
  static override styles = [
    propertyRowStyles
  ];

  @property({ type: String })
  declare label: string;

  @property({ type: String })
  declare description: string;

  constructor() {
    super();

    this.label = "";
    this.description = "";
  }

  override render(): TemplateResult {
    return html`
      <div class="row">
        ${this.label === "" ? nothing : html`<span class="label">${this.label}</span>`}
        <div class="value"><slot></slot></div>
      </div>
      ${this.description === ""
        ? nothing
        : html`
          <p class="description">
            <jolly-icon name="info"></jolly-icon>
            <span>${this.description}</span>
          </p>
        `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-property-row": PropertyRow;
  }
}
