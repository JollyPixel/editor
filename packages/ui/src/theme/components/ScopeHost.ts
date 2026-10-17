// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import { themeStyles } from "../styles/themeStyles.ts";

@customElement("jolly-scope")
export class ScopeHost extends LitElement {
  static override styles = [
    themeStyles
  ];

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scope": ScopeHost;
  }
}
