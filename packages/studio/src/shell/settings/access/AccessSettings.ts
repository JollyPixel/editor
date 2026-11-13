// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import type { AccountsRoster } from "@jolly-pixel/accounts";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/message";
import "@jolly-pixel/ui/elements/tab";
import "@jolly-pixel/ui/elements/tabs";
import "@jolly-pixel/ui/elements/text";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { AssetKindSet } from "../../../catalog/AssetKindSet.ts";
import type { AccessDraft } from "../../../project/AccessDraft.ts";
import { CapabilityCatalog } from "../../../project/CapabilityCatalog.ts";
import {
  roleSummaries,
  type RoleSummary
} from "../../../project/RoleSummary.ts";
import { RosterController } from "../../RosterController.ts";
import { StudioErrorEvent } from "../../StudioErrorEvent.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsEditEvent } from "../SettingsEditEvent.ts";
import "./RoleList.ts";
import "./RoleMembers.ts";
import "./RolePermissions.ts";
import "./RoleRulesEditor.ts";

type RoleTab = "permissions" | "members" | "advanced";

@customElement("studio-access-settings")
export class AccessSettings extends LitElement {
  static override styles = [settingsStyles, css`
    .layout {
      display: grid;
      grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
      gap: var(--jolly-space-4);
      align-items: start;
    }

    studio-role-list {
      position: sticky;
      top: 0;
    }

    .detail {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2);
      min-width: 0;
    }

    .head {
      display: flex;
      align-items: end;
      gap: var(--jolly-space-2);
    }

    .head jolly-text {
      flex: 1;
    }

    h3 {
      margin: 0;
      font-size: 1.1em;
    }

    jolly-tab {
      padding-top: var(--jolly-space-2);
    }
  `];

  #roster = new RosterController(this);
  #catalog = new CapabilityCatalog([]);

  @property({ attribute: false })
  declare value: AccessDraft | null;

  @property({ attribute: false })
  declare saved: AccessDraft | null;

  @property({ attribute: false })
  declare kinds: AssetKindSet | null;

  @state()
  declare _role: string;

  @state()
  declare _tab: RoleTab;

  @state()
  declare _error: string | null;

  @query("jolly-text[data-field=role-name]")
  declare _name: HTMLElementTagNameMap["jolly-text"] | null;

  constructor() {
    super();
    this.value = null;
    this.saved = null;
    this.kinds = null;
    this._role = "";
    this._tab = "permissions";
    this._error = null;
  }

  set roster(
    roster: AccountsRoster
  ) {
    this.#roster.attach(roster);
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("kinds")) {
      this.#catalog = new CapabilityCatalog(this.kinds?.entries ?? []);
    }
  }

  override render(): TemplateResult | typeof nothing {
    const draft = this.value;
    if (draft === null) {
      return nothing;
    }
    const roles = roleSummaries(draft, this.#roster.current ?? []);
    const role = roles.find(({ name }) => name === this._role) ??
      roles.find(({ name }) => name === draft.defaultRole);
    if (role === undefined) {
      return nothing;
    }

    return html`
      <div
        class="layout"
        @access-draft=${(event: HTMLElementEventMap["access-draft"]) => {
          this.#edit(() => event.draft);
        }}
      >
        <studio-role-list
          .roles=${roles}
          .selected=${role.name}
          @role-select=${(event: HTMLElementEventMap["role-select"]) => {
            this._role = event.role;
            this._error = null;
          }}
          @role-create=${() => void this.#createRole(draft)}
        ></studio-role-list>
        <section class="detail" aria-label=${`Role ${role.name}`}>
          ${role.builtIn ?
            this.#builtIn(role) :
            this.#declared(draft, role)}
        </section>
      </div>
    `;
  }

  #builtIn(
    role: RoleSummary
  ): TemplateResult {
    return html`
      <h3>${role.name}</h3>
      <jolly-message flush>${role.description}</jolly-message>
      ${this.#members(role)}
    `;
  }

  #declared(
    draft: AccessDraft,
    role: RoleSummary
  ): TemplateResult {
    const { name, deleteBlocker } = role;

    return html`
      <div class="head">
        <jolly-text
          data-field="role-name"
          label="Name"
          description="Accounts holding the role keep it under the new name"
          description-display="tooltip"
          .value=${live(name)}
          @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
            this.#rename(draft, name, event.detail.value);
          }}
        ></jolly-text>
        <jolly-button
          data-action="delete-role"
          variant="danger"
          ?disabled=${deleteBlocker !== null}
          title=${deleteBlocker ?? "Delete this role"}
          @click=${() => {
            this.#edit(() => draft.deleteRole(name));
          }}
        >Delete</jolly-button>
      </div>
      ${this._error === null ? nothing : html`
        <jolly-message tone="danger" flush role="alert">${this._error}</jolly-message>
      `}
      <jolly-tabs
        .value=${this._tab}
        @jolly-tab-change=${(event: CustomEvent<{ value: RoleTab; }>) => {
          this._tab = event.detail.value;
        }}
      >
        <jolly-tab value="permissions" label="Permissions">
          <studio-role-permissions
            .catalog=${this.#catalog}
            .draft=${draft}
            .role=${name}
          ></studio-role-permissions>
        </jolly-tab>
        ${role.members === null ? nothing : html`
          <jolly-tab value="members" label="Members" badge=${String(role.members)}>
            ${this.#members(role)}
          </jolly-tab>
        `}
        <jolly-tab value="advanced" label="Advanced">
          <studio-role-rules-editor
            .draft=${draft}
            .role=${name}
            .suggestions=${this.#catalog.eventKeys}
          ></studio-role-rules-editor>
        </jolly-tab>
      </jolly-tabs>
    `;
  }

  #members(
    role: RoleSummary
  ): TemplateResult | typeof nothing {
    const roster = this.#roster.current;
    const { heldAs } = role;
    if (roster === null || heldAs === null) {
      return nothing;
    }
    const fallbackRole = this.saved?.defaultRole ?? null;

    return html`
      <studio-role-members
        .accounts=${[...roster]}
        .role=${heldAs}
        .fallbackRole=${fallbackRole === heldAs ? null : fallbackRole}
        @role-assign=${(event: HTMLElementEventMap["role-assign"]) => {
          roster.assignRole(event.username, event.role).catch((error: unknown) => {
            this.dispatchEvent(StudioErrorEvent.from(error));
          });
        }}
      ></studio-role-members>
    `;
  }

  async #createRole(
    draft: AccessDraft
  ): Promise<void> {
    const name = draft.newRoleName();
    if (!this.#edit(() => draft.addRole(name))) {
      return;
    }
    this._role = name;
    this._tab = "permissions";
    await this.updateComplete;
    this._name?.select();
  }

  #rename(
    draft: AccessDraft,
    role: string,
    name: string
  ): void {
    if (this.#edit(() => draft.renameRole(role, name))) {
      this._role = name.trim();
    }
  }

  #edit(
    change: () => AccessDraft
  ): boolean {
    try {
      this.dispatchEvent(new SettingsEditEvent("access", change()));
      this._error = null;

      return true;
    }
    catch (error) {
      this._error = errorMessage(error);

      return false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-access-settings": AccessSettings;
  }
}
