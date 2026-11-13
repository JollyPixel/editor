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
  state
} from "lit/decorators.js";
import type {
  AccessRequest,
  AccountsRoster
} from "@jolly-pixel/accounts";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/checkbox";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/separator";

// Import Internal Dependencies
import { roleLabel } from "../../../accounts/UsersTreeModel.ts";
import type { AccessDraft } from "../../../project/AccessDraft.ts";
import { listRowStyles } from "../../listRowStyles.ts";
import { RosterController } from "../../RosterController.ts";
import { StudioErrorEvent } from "../../StudioErrorEvent.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsEditEvent } from "../SettingsEditEvent.ts";

@customElement("studio-project-new-accounts")
export class ProjectNewAccounts extends LitElement {
  static override styles = [settingsStyles, listRowStyles, css`
    ul.rows > li jolly-select {
      flex: 0 0 160px;

      --jolly-label-width: auto;
    }
  `];

  #roster = new RosterController(this);

  @property({ attribute: false })
  declare value: AccessDraft | null;

  @property({ attribute: false })
  declare saved: AccessDraft | null;

  @state()
  declare _approveAs: ReadonlyMap<string, string>;

  constructor() {
    super();
    this.value = null;
    this.saved = null;
    this._approveAs = new Map();
  }

  set roster(
    roster: AccountsRoster
  ) {
    this.#roster.attach(roster);
  }

  override render(): TemplateResult | typeof nothing {
    const { value } = this;
    if (value === null) {
      return nothing;
    }

    return html`
      <section aria-label="New accounts">
        <jolly-separator label="New accounts"></jolly-separator>
        <jolly-select
          data-field="default-role"
          label="Default role"
          description="The role a new account gets"
          description-display="tooltip"
          .options=${value.roles.map((role) => {
            return {
              value: role,
              label: role
            };
          })}
          .value=${value.defaultRole}
          @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
            this.#edit(value.withDefaultRole(event.detail.value));
          }}
        ></jolly-select>
        <jolly-checkbox
          data-field="access-requests"
          label="Access requests"
          description="Registering without the master password asks an admin first"
          .value=${value.accessRequests}
          @jolly-change=${(event: CustomEvent<{ value: boolean; }>) => {
            this.#edit(value.withAccessRequests(event.detail.value));
          }}
        ></jolly-checkbox>
        ${this.#requests()}
      </section>
    `;
  }

  #edit(
    access: AccessDraft
  ): void {
    this.dispatchEvent(new SettingsEditEvent("access", access));
  }

  #requests(): TemplateResult | typeof nothing {
    const roster = this.#roster.current;
    if (roster === null || roster.requests.length === 0) {
      return nothing;
    }
    const roles = roster.roles.map((role) => {
      return {
        value: role,
        label: roleLabel(role)
      };
    });

    return html`
      <ul class="rows" aria-label="Pending access requests">
        ${roster.requests.map((request) => {
          const role = this.#approveRole(request, roster);

          return html`
            <li data-request=${request.username}>
              <span class="row-text">
                <span class="row-title">${request.username}</span>
              </span>
              <jolly-select
                label="Approve as"
                .options=${roles}
                .value=${role}
                @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
                  this._approveAs = new Map(this._approveAs)
                    .set(request.username, event.detail.value);
                }}
              ></jolly-select>
              <jolly-button
                data-action="approve"
                variant="accent"
                @click=${() => this.#run(roster.approve(request.username, role))}
              >Approve</jolly-button>
              <jolly-button
                data-action="deny"
                variant="danger"
                @click=${() => void this.#deny(roster, request)}
              >Deny</jolly-button>
            </li>
          `;
        })}
      </ul>
    `;
  }

  #approveRole(
    request: AccessRequest,
    roster: AccountsRoster
  ): string {
    const chosen = this._approveAs.get(request.username);
    if (chosen !== undefined && roster.roles.includes(chosen)) {
      return chosen;
    }
    const defaultRole = this.saved?.defaultRole;

    return defaultRole !== undefined && roster.roles.includes(defaultRole) ?
      defaultRole :
      roster.roles[0];
  }

  async #deny(
    roster: AccountsRoster,
    request: AccessRequest
  ): Promise<void> {
    const confirmed = await showConfirm({
      title: `Deny "${request.username}"?`,
      message: "The request will be deleted and the username freed.",
      confirmLabel: "Deny",
      danger: true
    });
    if (confirmed) {
      this.#run(roster.deny(request.username));
    }
  }

  #run(
    change: Promise<void>
  ): void {
    change.catch((error: unknown) => {
      this.dispatchEvent(StudioErrorEvent.from(error));
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-new-accounts": ProjectNewAccounts;
  }
}
