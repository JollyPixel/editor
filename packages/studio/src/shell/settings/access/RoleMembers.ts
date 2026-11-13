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
import type { RosterEntry } from "@jolly-pixel/accounts";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/message";

// Import Internal Dependencies
import { listRowStyles } from "../../listRowStyles.ts";
import { settingsStyles } from "../settingsStyles.ts";

export class RoleAssignEvent extends Event {
  readonly username: string;
  readonly role: string;

  constructor(
    username: string,
    role: string
  ) {
    super("role-assign");
    this.username = username;
    this.role = role;
  }
}

@customElement("studio-role-members")
export class RoleMembers extends LitElement {
  static override styles = [settingsStyles, listRowStyles];

  @property({ attribute: false })
  declare accounts: readonly RosterEntry[];

  @property({ attribute: false })
  declare role: string;

  @property({ attribute: false })
  declare fallbackRole: string | null;

  @query("jolly-context-menu")
  declare _menu: HTMLElementTagNameMap["jolly-context-menu"] | null;

  constructor() {
    super();
    this.accounts = [];
    this.role = "";
    this.fallbackRole = null;
  }

  override render(): TemplateResult {
    const members = this.accounts.filter((entry) => entry.role === this.role);
    const candidates = this.accounts.filter(
      (entry) => entry.role !== this.role && !entry.owner
    );

    return html`
      <section aria-label="Members">
        <div>
          <jolly-button
            data-action="add-members"
            icon="plus"
            ?disabled=${candidates.length === 0}
            @click=${(event: MouseEvent) => this.#openPicker(event, candidates)}
          >Add members</jolly-button>
        </div>
        ${members.length === 0 ?
          html`<jolly-message flush>No account holds this role.</jolly-message>` :
          html`
            <ul class="rows" aria-label="Accounts holding the role">
              ${members.map((entry) => this.#member(entry))}
            </ul>
          `}
        <jolly-context-menu
          label="Add a member"
          @jolly-context-action=${(event: HTMLElementEventMap["jolly-context-action"]) => {
            this.dispatchEvent(new RoleAssignEvent(event.detail.id, this.role));
          }}
        ></jolly-context-menu>
      </section>
    `;
  }

  #member(
    entry: RosterEntry
  ): TemplateResult {
    const { fallbackRole } = this;

    return html`
      <li data-member=${entry.username}>
        <span class="row-text">
          <span class="row-title">${entry.username}</span>
          ${entry.owner ? html`<span class="row-meta">Owner</span>` : nothing}
        </span>
        ${fallbackRole === null ? nothing : html`
          <jolly-button
            data-action="remove-member"
            ?disabled=${entry.owner}
            title=${entry.owner ?
              "The owner stays an admin" :
              `Moves the account to the ${fallbackRole} role`}
            @click=${() => {
              this.dispatchEvent(new RoleAssignEvent(entry.username, fallbackRole));
            }}
          >Remove</jolly-button>
        `}
      </li>
    `;
  }

  #openPicker(
    event: MouseEvent,
    candidates: readonly RosterEntry[]
  ): void {
    const menu = this._menu;
    if (menu === null) {
      return;
    }

    menu.items = candidates.map((entry) => {
      return {
        id: entry.username,
        label: entry.username
      };
    });
    menu.openAt(event.clientX, event.clientY);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-role-members": RoleMembers;
  }

  interface HTMLElementEventMap {
    "role-assign": RoleAssignEvent;
  }
}
