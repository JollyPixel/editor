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
import { toolbarStyles } from "./Toolbar.styles.ts";

export type ToolbarOrientation = "horizontal" | "vertical";

@customElement("jolly-toolbar")
export class Toolbar extends LitElement {
  static override styles = [
    toolbarStyles
  ];

  @property({ type: String, reflect: true })
  declare orientation: ToolbarOrientation;

  @property({ type: String })
  declare label: string;

  constructor() {
    super();

    this.orientation = "horizontal";
    this.label = "";
  }

  override render(): TemplateResult {
    return html`
      <div
        role="toolbar"
        aria-label=${this.label}
        aria-orientation=${this.orientation}
      ><slot></slot></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-toolbar": Toolbar;
  }
}
