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
import { railStyles } from "./Rail.styles.ts";

export type RailOrientation = "horizontal" | "vertical";

@customElement("jolly-rail")
export class Rail extends LitElement {
  static override styles = [
    railStyles
  ];

  @property({ type: String, reflect: true })
  declare orientation: RailOrientation;

  constructor() {
    super();

    this.orientation = "vertical";
  }

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-rail": Rail;
  }
}
