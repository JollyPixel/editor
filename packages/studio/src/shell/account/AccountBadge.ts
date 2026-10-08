// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import type { Account } from "@jolly-pixel/accounts";

@customElement("studio-account")
export class AccountBadge extends LitElement {
  @property({ attribute: false })
  declare account: Account | null;

  constructor() {
    super();
    this.account = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult | typeof nothing {
    if (this.account === null) {
      return nothing;
    }

    return html`
      <span class="account-name">${this.account.username}</span>
      <jolly-button
        data-action="sign-out"
        variant="danger"
        icon="sign-out"
        @click=${this.#signOut}
      >Sign out</jolly-button>
    `;
  }

  #signOut(): void {
    this.dispatchEvent(new CustomEvent("sign-out", {
      bubbles: true,
      composed: true
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-account": AccountBadge;
  }

  interface HTMLElementEventMap {
    "sign-out": CustomEvent<undefined>;
  }
}
