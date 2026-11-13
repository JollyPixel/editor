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
import { keyed } from "lit/directives/keyed.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import "@jolly-pixel/ui/elements/icon";
import "@jolly-pixel/ui/elements/tab";
import "@jolly-pixel/ui/elements/tabs";
import type { PreferenceScopes } from "@jolly-pixel/server";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import {
  STUDIO_USER_CHANGE,
  type StudioUser
} from "../../accounts/StudioUser.ts";
import { BrowserState } from "../../browser/BrowserState.ts";
import { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import type { ProjectDrafts } from "../../project/ProjectDrafts.ts";
import { ChangeController } from "../ChangeController.ts";
import { cardStyles } from "../cardStyles.ts";
import {
  SettingsSections,
  type SettingsGroup,
  type SettingsSection
} from "./SettingsSections.ts";
import { ProjectSettingsController } from "./project/ProjectSettingsController.ts";
import "./AccessKeys.ts";
import "./AccountSettings.ts";
import "./PageReset.ts";
import "./PreferencesPage.ts";
import "./SettingsSaveBar.ts";
import "./access/AccessSettings.ts";
import "./audit/AuditView.ts";
import "./project/ProjectGame.ts";
import "./project/ProjectPhysics.ts";
import "./project/ProjectGeneral.ts";
import "./project/ProjectKindPackage.ts";
import "./project/ProjectNewAccounts.ts";
import "./project/ProjectSnapshot.ts";

// CONSTANTS
const kWideKinds: ReadonlySet<SettingsSection["kind"]> = new Set([
  "preferences",
  "access"
]);

type ProjectSection = Exclude<
  SettingsSection,
  { kind: "account" | "preferences"; }
>;

@customElement("studio-settings")
export class StudioSettings extends LitElement {
  static override styles = [cardStyles, css`
    :host {
      display: flex;
      gap: var(--studio-gutter);
      width: 100%;
      height: 100%;
    }

    :host([hidden]) {
      display: none;
    }

    .menu {
      flex: 0 0 220px;
    }

    .menu jolly-tabs {
      flex: 0 0 auto;
    }

    .menu jolly-tabs::part(list) {
      flex: 1 1 auto;
    }

    .menu jolly-tabs::part(tab) {
      flex: 1 1 0;
    }

    nav {
      flex: 1 1 auto;
      min-height: 0;
      padding-block: var(--jolly-space-2);
      overflow-y: auto;
    }

    nav section + section {
      margin-top: var(--jolly-space-3);
    }

    nav h3 {
      margin: 0;
      padding: var(--jolly-space-1) var(--jolly-space-3);
      color: var(--jolly-text-muted);
      font-size: 0.8em;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    nav ul {
      margin: 0;
      padding: 0 var(--jolly-space-1);
      list-style: none;
    }

    nav button {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2);
      box-sizing: border-box;
      width: 100%;
      min-height: 28px;
      padding: 0 var(--jolly-space-2);
      border: none;
      border-radius: var(--jolly-radius-sm);
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    nav button:hover {
      background: var(--jolly-control-bg-hover);
    }

    nav button[aria-current="page"] {
      background: var(--jolly-control-bg-active);
      font-weight: 600;
    }

    nav button:focus-visible {
      outline: 2px solid var(--jolly-focus-ring);
      outline-offset: -2px;
    }

    nav button jolly-icon {
      flex: 0 0 auto;
      width: 16px;
      height: 16px;
    }

    nav button span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    nav button .unsaved {
      flex: 0 0 auto;
      width: 8px;
      height: 8px;
      margin-inline-start: auto;
      border-radius: 50%;
      background: var(--jolly-accent-fill);
    }

    section.card {
      flex: 1 1 auto;
    }

    section.card > .card-head {
      min-height: calc(var(--studio-card-head-height) + var(--jolly-space-3));
    }

    section.card .card-title {
      align-items: center;
      font-size: 1.4em;
    }

    .card-title jolly-icon {
      flex: 0 0 auto;
      width: 20px;
      height: 20px;
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-4);
      max-width: var(--studio-settings-column);

      --studio-settings-column: 640px;
      --jolly-label-width: 22ch;
      --jolly-field-inset-start: 0px;
    }

    .card-body.wide {
      max-width: calc(var(--studio-settings-column) * 2 + var(--jolly-space-4));
    }
  `];

  @property({ attribute: false })
  declare sections: SettingsSections;

  @property({ attribute: false })
  declare scopes: PreferenceScopes | null;

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  @property({ attribute: false })
  declare kinds: AssetKindSet;

  @property({ attribute: false })
  declare browserState: BrowserState;

  #user = new ChangeController<StudioUser>(this, STUDIO_USER_CHANGE);
  #project = new ProjectSettingsController(this);
  #visited = new Map<string, string>();

  constructor() {
    super();
    this.sections = SettingsSections.EMPTY;
    this.scopes = null;
    this.catalog = null;
    this.kinds = AssetKindSet.EMPTY;
    this.browserState = new BrowserState();
  }

  set user(
    user: StudioUser | null
  ) {
    if (user !== null) {
      this.#user.attach(user);
    }
    if (user?.online) {
      this.#project.attach(user.project);
    }
  }

  get section(): string {
    return this.browserState.settingsSection;
  }

  set section(
    id: string
  ) {
    this.browserState.settingsSection = id;
    this.requestUpdate();
  }

  override render(): TemplateResult {
    const current = this.sections.find(this.section) ?? this.sections.first;
    const tab = current === undefined ?
      undefined :
      this.sections.tabHolding(current.id);
    const wide = current !== undefined && kWideKinds.has(current.kind);
    const project = this.#project.current;
    const drafts = project?.drafts ?? null;

    return html`
      <div class="card menu">
        ${this.sections.tabs.length > 1 ? html`
          <jolly-tabs
            aria-label="Settings scopes"
            .value=${tab?.id ?? ""}
            @jolly-tab-change=${this.#onTabChange}
          >
            ${this.sections.tabs.map((entry) => html`
              <jolly-tab
                value=${entry.id}
                label=${entry.label}
                icon=${entry.icon}
                ?modified=${drafts !== null && entry.unsaved(drafts)}
              ></jolly-tab>
            `)}
          </jolly-tabs>
        ` : nothing}
        <nav aria-label="Settings sections">
          ${(tab?.groups ?? []).map(
            (group) => this.#group(group, current, drafts)
          )}
        </nav>
      </div>
      <section class="card" aria-label=${current?.label ?? "Settings"}>
        <header class="card-head">
          <h2 class="card-title">
            ${current?.icon === undefined ?
              nothing :
              html`<jolly-icon
                name=${current.icon}
                tone=${current.tone ?? ""}
              ></jolly-icon>`}
            ${current?.label ?? ""}
          </h2>
          ${current?.kind === "preferences" ? html`
            <studio-page-reset
              label=${current.label}
              .scopes=${current.scopes}
              .preferences=${this.#user.current?.preferences ?? null}
            ></studio-page-reset>
          ` : nothing}
        </header>
        <div
          class="card-body ${wide ? "wide" : ""}"
          @settings-edit=${(event: HTMLElementEventMap["settings-edit"]) => {
            drafts?.edit(event.section, event.value);
          }}
        >
          ${current === undefined ? nothing : this.#content(current)}
        </div>
        ${project === null ? nothing : html`
          <studio-settings-save-bar .project=${project}></studio-settings-save-bar>
        `}
      </section>
    `;
  }

  readonly #onTabChange = (
    event: CustomEvent<{ value: string; }>
  ): void => {
    const current = this.sections.find(this.section);
    const left = current === undefined ?
      undefined :
      this.sections.tabHolding(current.id);
    if (left !== undefined && current !== undefined) {
      this.#visited.set(left.id, current.id);
    }

    const next = this.sections.tabs.find(
      (entry) => entry.id === event.detail.value
    );
    if (next !== undefined) {
      this.section = this.#visited.get(next.id) ?? next.first.id;
    }
  };

  readonly #onSectionClick = (
    event: MouseEvent
  ): void => {
    const { currentTarget } = event;
    if (currentTarget instanceof HTMLElement && currentTarget.dataset.section) {
      this.section = currentTarget.dataset.section;
    }
  };

  #group(
    group: SettingsGroup,
    current: SettingsSection | undefined,
    drafts: ProjectDrafts | null
  ): TemplateResult {
    const headingId = `settings-group-${group.id}`;

    return html`
      <section aria-labelledby=${group.label === undefined ? nothing : headingId}>
        ${group.label === undefined ?
          nothing :
          html`<h3 id=${headingId}>${group.label}</h3>`}
        <ul>
          ${group.sections.map((section) => html`
            <li>
              <button
                type="button"
                data-section=${section.id}
                aria-current=${section === current ? "page" : nothing}
                @click=${this.#onSectionClick}
              >
                ${section.icon === undefined ?
                  nothing :
                  html`<jolly-icon
                    name=${section.icon}
                    tone=${section.tone ?? ""}
                  ></jolly-icon>`}
                <span>${section.label}</span>
                ${drafts !== null && section.unsaved?.(drafts) ?
                  html`<span
                    class="unsaved"
                    role="img"
                    aria-label="Unsaved changes"
                  ></span>` :
                  nothing}
              </button>
            </li>
          `)}
        </ul>
      </section>
    `;
  }

  #content(
    section: SettingsSection
  ): TemplateResult | typeof nothing {
    const user = this.#user.current;
    switch (section.kind) {
      case "account":
        return html`
          <studio-account-settings
            .account=${user?.online ? user.account : null}
            .preferences=${user?.preferences ?? null}
            .scopes=${this.scopes}
          ></studio-account-settings>
        `;
      case "preferences":
        return html`
          <studio-preferences-page
            .forms=${section.forms}
            .keyBindings=${section.keyBindings}
            .shortcutScopes=${this.sections.shortcutScopes}
            .preferences=${user?.preferences ?? null}
          ></studio-preferences-page>
        `;
      default:
        return user?.online ?
          this.#projectContent(section, user) :
          nothing;
    }
  }

  #projectContent(
    section: ProjectSection,
    user: StudioSignedIn
  ): TemplateResult | typeof nothing {
    const { project } = user;
    const { drafts } = project;
    const disabled = !project.canEdit;
    switch (section.kind) {
      case "access-keys":
        return html`
          <studio-access-keys
            .tokens=${user.agentTokens}
            .links=${user.shares}
            .catalog=${this.catalog}
            .kinds=${this.kinds}
          ></studio-access-keys>
        `;
      case "general":
        return html`
          <studio-project-general
            name=${project.data?.name ?? ""}
            .kinds=${this.kinds}
            .value=${drafts.section("kindFilter").current}
            ?disabled=${disabled}
          ></studio-project-general>
          ${user.rights.allows("manageAccess") ? html`
            <studio-project-new-accounts
              .value=${drafts.section("access").current}
              .saved=${drafts.section("access").saved}
              .roster=${user.roster}
            ></studio-project-new-accounts>
          ` : nothing}
          <studio-project-game
            .value=${drafts.section("game").current}
            .catalog=${this.catalog}
            ?disabled=${disabled}
          ></studio-project-game>
          <studio-project-physics
            .value=${drafts.section("physics").current}
            ?disabled=${disabled}
          ></studio-project-physics>
          <studio-project-snapshot
            .value=${drafts.section("snapshot").current}
            ?disabled=${disabled}
          ></studio-project-snapshot>
        `;
      case "kind-package":
        return html`${keyed(section.id, html`
          <studio-project-kind-package
            .settings=${project.data?.kinds.find(
              (candidate) => candidate.name === section.packageName
            ) ?? null}
            .value=${drafts.section("kinds").current}
            ?disabled=${disabled}
          ></studio-project-kind-package>
        `)}`;
      case "access":
        return html`
          <studio-access-settings
            .value=${drafts.section("access").current}
            .saved=${drafts.section("access").saved}
            .roster=${user.roster}
            .kinds=${this.kinds}
          ></studio-access-settings>
        `;
      case "audit":
        return html`
          <studio-audit-view
            .user=${user}
            .catalog=${this.catalog}
          ></studio-audit-view>
        `;
      default:
        return section satisfies never;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-settings": StudioSettings;
  }
}
