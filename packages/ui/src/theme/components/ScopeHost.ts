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
 * A declarative theme scope host for content with no scope host of its own
 * (`jolly-dialog` is the one container that self-scopes; see docs/theming.md).
 * Set `theme` or `density` on it directly, the same as any scope host.
 *
 * Declares no `display`: a `:host` rule here would beat a consumer's own
 * `jolly-scope { display: ... }` on specificity regardless of source order,
 * and the right layout role (`contents`, `fixed`, ...) is theirs to pick.
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
