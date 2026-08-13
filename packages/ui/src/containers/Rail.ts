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

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";

export type RailOrientation = "horizontal" | "vertical";

@customElement("jolly-rail")
export class Rail extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      flex-direction: column;
      gap: var(--jolly-space-1, 4px);
      width: calc(var(--jolly-icon-button-size, 32px) + (var(--jolly-space-1, 4px) * 2));
      padding: var(--jolly-space-1, 4px);
      border: 0;
      background: var(--jolly-surface-sunken, ${kFallback.controlBg});
    }

    :host([orientation="horizontal"]) {
      flex-direction: row;
      width: auto;
      height: calc(var(--jolly-icon-button-size, 32px) + (var(--jolly-space-1, 4px) * 2));
    }
  `;

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
