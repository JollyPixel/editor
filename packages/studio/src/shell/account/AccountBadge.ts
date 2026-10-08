// Import Third-party Dependencies
import {
  LitElement,
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
import type { ContextMenuEntry } from "@jolly-pixel/ui";

// CONSTANTS
const kMenu: readonly ContextMenuEntry[] = [
  {
    id: "change-avatar",
    label: "Change avatar…"
  },
  "separator",
  {
    id: "sign-out",
    label: "Sign out",
    icon: "sign-out",
    intent: "danger"
  }
];

export interface AvatarChangeDetail {
  image: File;
}

@customElement("studio-account")
export class AccountBadge extends LitElement {
  @property({ attribute: false })
  declare account: Account | null;

  @property({ attribute: false })
  declare avatar: string;

  @query("jolly-context-menu")
  declare _menu: HTMLElementTagNameMap["jolly-context-menu"] | null;

  @query("input[type=file]")
  declare _picker: HTMLInputElement | null;

  constructor() {
    super();
    this.account = null;
    this.avatar = "";
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
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
        ></jolly-avatar>
        <span class="account-name">${this.account.username}</span>
      </jolly-button>
      <jolly-context-menu
        label="Account"
        .items=${kMenu}
        @jolly-context-action=${this.#onAction}
      ></jolly-context-menu>
      <input
        type="file"
        accept="image/*"
        hidden
        @change=${this.#onPick}
      />
    `;
  }

  readonly #openMenu = (
    event: MouseEvent
  ): void => {
    const button = event.currentTarget;
    if (this._menu === null || !(button instanceof HTMLElement)) {
      return;
    }

    const { left, bottom } = button.getBoundingClientRect();
    this._menu.openAt(left, bottom);
  };

  readonly #onAction = (
    event: HTMLElementEventMap["jolly-context-action"]
  ): void => {
    switch (event.detail.id) {
      case "change-avatar":
        this._picker?.click();
        break;
      case "sign-out":
        this.dispatchEvent(new CustomEvent("sign-out", {
          bubbles: true,
          composed: true
        }));
        break;
    }
  };

  readonly #onPick = (): void => {
    const image = this._picker?.files?.[0];
    if (this._picker !== null) {
      this._picker.value = "";
    }
    if (image === undefined) {
      return;
    }

    this.dispatchEvent(new CustomEvent<AvatarChangeDetail>("avatar-change", {
      bubbles: true,
      composed: true,
      detail: {
        image
      }
    }));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-account": AccountBadge;
  }

  interface HTMLElementEventMap {
    "sign-out": CustomEvent<undefined>;
    "avatar-change": CustomEvent<AvatarChangeDetail>;
  }
}
