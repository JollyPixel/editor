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

@customElement("jolly-rail-group")
export class RailGroup extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
    }

    :host([divided])::before {
      content: "";
      flex: 0 0 auto;
      width: 1px;
      height: 22px;
      margin-inline: var(--jolly-rail-group-divider-inset, 6px);
      background: var(--jolly-divider);
    }
  `;

  @property({ type: Boolean, reflect: true })
  declare divided: boolean;

  constructor() {
    super();

    this.divided = false;
  }

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-rail-group": RailGroup;
  }
}
