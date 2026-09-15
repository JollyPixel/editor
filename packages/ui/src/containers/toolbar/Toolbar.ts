// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

export type ToolbarOrientation = "horizontal" | "vertical";

@customElement("jolly-toolbar")
export class Toolbar extends LitElement {
  static override styles = css`
    :host,
    div {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
    }

    :host {
      min-width: 0;
      color: var(--jolly-text);
      font: inherit;
    }

    :host([orientation="vertical"]),
    :host([orientation="vertical"]) div {
      align-items: stretch;
      flex-direction: column;
    }
  `;

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
