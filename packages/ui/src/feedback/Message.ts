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
import { messageStyles } from "./Message.styles.ts";

export type MessageTone = "muted" | "danger" | "warning";

@customElement("jolly-message")
export class Message extends LitElement {
  static override styles = messageStyles;

  @property({ type: String, reflect: true })
  declare tone: MessageTone;

  @property({ type: Boolean, reflect: true })
  declare flush: boolean;

  constructor() {
    super();
    this.tone = "muted";
    this.flush = false;
  }

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-message": Message;
  }
}
