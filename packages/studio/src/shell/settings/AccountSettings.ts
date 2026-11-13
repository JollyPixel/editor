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
  property
} from "lit/decorators.js";
import type { Account } from "@jolly-pixel/accounts";
import type { Preferences } from "@jolly-pixel/preferences";
import type { PreferenceScopes } from "@jolly-pixel/server";
import "@jolly-pixel/ui/elements/avatar";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/separator";
import { pickFiles } from "@jolly-pixel/utils/dom";

// Import Internal Dependencies
import { roleLabel } from "../../accounts/UsersTreeModel.ts";
import { settingsStyles } from "./settingsStyles.ts";
import "./PreferencesTransfer.ts";

export interface AvatarChangeDetail {
  image: File;
}

@customElement("studio-account-settings")
export class AccountSettings extends LitElement {
  static override styles = [settingsStyles, css`
    :host {
      gap: var(--jolly-space-4);
    }

    .profile {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-3);
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
  `];

  @property({ attribute: false })
  declare account: Account | null;

  @property({ attribute: false })
  declare preferences: Preferences | null;

  @property({ attribute: false })
  declare scopes: PreferenceScopes | null;

  constructor() {
    super();
    this.account = null;
    this.preferences = null;
    this.scopes = null;
  }

  override render(): TemplateResult {
    return html`
      ${this.#profile()}
      <section aria-label="Preferences file">
        <jolly-separator label="Preferences file"></jolly-separator>
        <studio-preferences-transfer
          .preferences=${this.preferences}
          .scopes=${this.scopes}
        ></studio-preferences-transfer>
      </section>
    `;
  }

  #profile(): TemplateResult | typeof nothing {
    const { account } = this;
    if (account === null) {
      return nothing;
    }

    return html`
      <section aria-label="Profile">
        <jolly-separator label="Profile"></jolly-separator>
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
          <jolly-button
            data-action="change-avatar"
            @click=${this.#pick}
          >Change avatar…</jolly-button>
        </div>
      </section>
    `;
  }

  readonly #pick = async(): Promise<void> => {
    const [image] = await pickFiles({
      accept: "image/*"
    });
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
    "studio-account-settings": AccountSettings;
  }

  interface HTMLElementEventMap {
    "avatar-change": CustomEvent<AvatarChangeDetail>;
  }
}
