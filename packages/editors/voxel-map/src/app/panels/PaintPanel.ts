// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("paint-panel")
export class PaintPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paint-panel": PaintPanel;
  }
}
