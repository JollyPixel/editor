// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { monitorStyles } from "./Monitor.styles.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

/**
 * Read-only label and value row. `format` is ignored for a string value.
 */
@customElement("jolly-monitor")
export class MonitorElement extends LitElement {
  static override styles = [
    monitorStyles,
    hiddenStyles
  ];

  @property({ type: String })
  declare label: string;

  @property({ attribute: false })
  declare value: number | string;

  @property({ attribute: false })
  declare format: ((value: number) => string) | undefined;

  constructor() {
    super();

    this.label = "";
    this.value = "";
    this.format = undefined;
  }

  override render(): TemplateResult {
    return html`
      <div class="row">
        <span class="label">${this.label}</span>
        <span class="value">${this.#displayed}</span>
      </div>
    `;
  }

  get #displayed(): string {
    return typeof this.value === "number" && this.format !== undefined
      ? this.format(this.value)
      : String(this.value);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-monitor": MonitorElement;
  }
}
