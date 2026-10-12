// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";

// CONSTANTS
export const SETTINGS_TAB_ID = "studio:settings";

@customElement("studio-settings")
export class StudioSettings extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
    }

    :host([hidden]) {
      display: none;
    }
  `;

  override render(): TemplateResult {
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-settings": StudioSettings;
  }
}
