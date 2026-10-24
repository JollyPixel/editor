// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";
import type { Account } from "@jolly-pixel/accounts";
import "@jolly-pixel/ui/elements/avatar";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/icon";

// Import Internal Dependencies
import { accountMenu } from "./accountMenu.ts";

@customElement("studio-account")
export class AccountBadge extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
    }

    jolly-button {
      --jolly-control-height: 30px;
      --jolly-control-bg: transparent;
      --jolly-control-bg-hover: color-mix(
        in oklab,
        var(--studio-board) 80%,
        transparent
      );
      --jolly-control-bg-active: var(--studio-board);
      --jolly-avatar-size: 22px;
      --jolly-avatar-presence-ring: var(--studio-window);
    }

    jolly-avatar {
      margin-inline-end: var(--jolly-space-1);
    }

    .chevron {
      color: var(--jolly-text-muted);
      transform: rotate(90deg);

      --jolly-icon-size: 12px;
    }
  `;

  @property({ attribute: false })
  declare account: Account | null;

  @property({ attribute: false })
  declare avatar: string;

  @query("jolly-context-menu")
  declare _menu: HTMLElementTagNameMap["jolly-context-menu"] | null;

  constructor() {
    super();
    this.account = null;
    this.avatar = "";
  }

  override render(): TemplateResult | typeof nothing {
    if (this.account === null) {
      return nothing;
    }

    return html`
      <jolly-button
        data-action="account"
        aria-haspopup="menu"
        @click=${this.#openMenu}
      >
        <jolly-avatar
          peer-id=${this.account.id}
          image=${this.avatar}
          presence="online"
        ></jolly-avatar>
        <span class="account-name">${this.account.username}</span>
        <jolly-icon class="chevron" name="chevron"></jolly-icon>
      </jolly-button>
      <jolly-context-menu
        label="Account"
        .items=${accountMenu(this.account)}
        @jolly-context-action=${this.#onAction}
      ></jolly-context-menu>
    `;
  }

  readonly #openMenu = (
    event: MouseEvent
  ): void => {
    const button = event.currentTarget;
    if (this._menu === null || !(button instanceof HTMLElement)) {
      return;
    }

    const { right, bottom } = button.getBoundingClientRect();
    this._menu.openAt(right, bottom);
  };

  readonly #onAction = (
    event: HTMLElementEventMap["jolly-context-action"]
  ): void => {
    switch (event.detail.id) {
      case "settings":
        this.dispatchEvent(new Event("settings-open", {
          bubbles: true,
          composed: true
        }));
        break;
      case "sign-out":
        this.dispatchEvent(new CustomEvent("sign-out", {
          bubbles: true,
          composed: true
        }));
        break;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-account": AccountBadge;
  }

  interface HTMLElementEventMap {
    "sign-out": CustomEvent<undefined>;
  }
}
