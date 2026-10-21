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

// Import Internal Dependencies
import { roleLabel } from "../../accounts/UsersTreeModel.ts";

export interface AvatarChangeDetail {
  image: File;
}

@customElement("studio-profile-settings")
export class ProfileSettings extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--jolly-space-3);
    }

    .profile {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-3);
      align-self: stretch;
    }

    jolly-avatar {
      --jolly-avatar-size: 64px;
    }

    .identity {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--jolly-space-1);
      min-width: 0;
    }

    .username {
      font-weight: 600;
    }

    .role {
      color: var(--jolly-text-muted);
    }
  `;

  @property({ attribute: false })
  declare account: Account | null;

  @query("input[type=file]")
  declare _picker: HTMLInputElement | null;

  constructor() {
    super();
    this.account = null;
  }

  override render(): TemplateResult | typeof nothing {
    const { account } = this;
    if (account === null) {
      return nothing;
    }

    return html`
      <div class="profile">
        <jolly-avatar
          peer-id=${account.id}
          image=${account.avatar ?? ""}
        ></jolly-avatar>
        <div class="identity">
          <span class="username">${account.username}</span>
          <span class="role">
            ${account.owner ? "Owner" : roleLabel(account.role)}
          </span>
        </div>
      </div>
      <jolly-button
        data-action="change-avatar"
        @click=${this.#pick}
      >Change avatar…</jolly-button>
      <input
        type="file"
        accept="image/*"
        hidden
        @change=${this.#onPick}
      />
    `;
  }

  readonly #pick = (): void => {
    this._picker?.click();
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
    "studio-profile-settings": ProfileSettings;
  }

  interface HTMLElementEventMap {
    "avatar-change": CustomEvent<AvatarChangeDetail>;
  }
}
