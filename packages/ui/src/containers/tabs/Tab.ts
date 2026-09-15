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

@customElement("jolly-tab")
export class Tab extends LitElement {
  static override styles = css`
    :host {
      display: none;
      box-sizing: border-box;
      height: 100%;
    }

    :host([active]) {
      display: block;
    }
  `;

  @property({ type: String })
  declare label: string;

  @property({ type: String })
  declare value: string;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @property({ type: Boolean, reflect: true })
  declare active: boolean;

  constructor() {
    super();

    this.label = "";
    this.value = "";
    this.disabled = false;
    this.active = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "tabpanel");
  }

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-tab": Tab;
  }
}
