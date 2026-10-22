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

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import {
  STUDIO_USER_CHANGE,
  type StudioUser
} from "../../accounts/StudioUser.ts";
import { BrowserState } from "../../browser/BrowserState.ts";
import { ChangeController } from "../ChangeController.ts";
import { cardStyles } from "../cardStyles.ts";
import type { PreferenceScopes } from "../../../shared/PreferenceScopes.ts";
import {
  SettingsSections,
  type SettingsGroup,
  type SettingsSection
} from "./SettingsSections.ts";
import "../shares/ShareLinksPane.ts";
import "./PreferencesPage.ts";
import "./PreferencesTransfer.ts";
import "./ProfileSettings.ts";
import "./access/AccessSettings.ts";
import "./audit/AuditView.ts";
import "./project/ProjectGeneral.ts";
import "./project/ProjectKindPackage.ts";

// CONSTANTS
const kWideKinds: ReadonlySet<SettingsSection["kind"]> = new Set([
  "preferences",
  "access"
]);

type ProjectSection = Exclude<
  SettingsSection,
  { kind: "profile" | "preferences" | "preferences-file"; }
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

    nav {
      flex: 0 0 220px;
      padding-block: var(--jolly-space-2);
      overflow-y: auto;
    }

    nav section + section,
    nav .block + .block {
      margin-top: var(--jolly-space-3);
    }

    nav .block + .block {
      padding-top: var(--jolly-space-3);
      border-top: 1px solid var(--jolly-border);
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
      --jolly-field-inset-end: 0px;
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
  declare browserState: BrowserState;

  #user = new ChangeController<StudioUser>(this, STUDIO_USER_CHANGE);

  constructor() {
    super();
    this.sections = SettingsSections.EMPTY;
    this.scopes = null;
    this.catalog = null;
    this.browserState = new BrowserState();
  }

  set user(
    user: StudioUser | null
  ) {
    if (user !== null) {
      this.#user.attach(user);
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
    const wide = current !== undefined && kWideKinds.has(current.kind);

    return html`
      <nav class="card" aria-label="Settings sections">
        ${this.sections.blocks.map((block) => html`
          <div class="block">
            ${block.map((group) => this.#group(group, current))}
          </div>
        `)}
      </nav>
      <section class="card" aria-label=${current?.label ?? "Settings"}>
        <header class="card-head">
          <h2 class="card-title">
            ${current?.icon === undefined ?
              nothing :
              html`<jolly-icon name=${current.icon}></jolly-icon>`}
            ${current?.label ?? ""}
          </h2>
        </header>
        <div class="card-body ${wide ? "wide" : ""}">
          ${current === undefined ? nothing : this.#content(current)}
        </div>
      </section>
    `;
  }

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
    current: SettingsSection | undefined
  ): TemplateResult {
    const headingId = `settings-group-${group.id}`;

    return html`
      <section aria-labelledby=${headingId}>
        <h3 id=${headingId}>${group.label}</h3>
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
                  html`<jolly-icon name=${section.icon}></jolly-icon>`}
                <span>${section.label}</span>
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
      case "profile":
        return html`
          <studio-profile-settings
            .account=${user?.online ? user.account : null}
          ></studio-profile-settings>
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
      case "preferences-file":
        return html`
          <studio-preferences-transfer
            .preferences=${user?.preferences ?? null}
            .scopes=${this.scopes}
          ></studio-preferences-transfer>
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
    switch (section.kind) {
      case "share-links":
        return this.catalog === null ? nothing : html`
          <studio-share-links
            .links=${user.shares}
            .catalog=${this.catalog}
          ></studio-share-links>
        `;
      case "general":
        return html`
          <studio-project-general
            .project=${project}
          ></studio-project-general>
        `;
      case "kind-package":
        return html`${keyed(section.id, html`
          <studio-project-kind-package
            .project=${project}
            .packageName=${section.packageName}
          ></studio-project-kind-package>
        `)}`;
      case "access":
        return html`
          <studio-access-settings
            .project=${project}
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
