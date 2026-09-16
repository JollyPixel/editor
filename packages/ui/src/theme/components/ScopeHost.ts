// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import { themeStyles } from "../styles/themeStyles.ts";

/**
 * Declarative theme scope host; set `theme` or `density` on it.
 * No `:host { display }` rule, so the consumer's own rule wins.
 */
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
