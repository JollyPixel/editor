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
import { keyed } from "lit/directives/keyed.js";
import type { Account } from "@jolly-pixel/accounts";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import { BrowserState } from "../../browser/BrowserState.ts";
import { cardStyles } from "../cardStyles.ts";
import {
  SettingsSections,
  type SettingsSection
} from "./SettingsSections.ts";
import "../shares/ShareLinksPane.ts";
import "./PreferencesPage.ts";
import "./ProfileSettings.ts";
import "./access/AccessSettings.ts";
import "./audit/AuditView.ts";
import "./project/ProjectGeneral.ts";
import "./project/ProjectKindPackage.ts";

// CONSTANTS
export const SETTINGS_TAB_ID = "studio:settings";

type ProjectSection = Exclude<
  SettingsSection,
  { kind: "profile" | "preferences"; }
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
      display: flex;
      flex: 0 0 220px;
      flex-direction: column;
      min-height: 0;
      padding: var(--jolly-space-2) var(--jolly-space-1);
    }

    jolly-tree {
      flex: 1 1 auto;
      min-height: 0;
      --jolly-row-height: 26px;
      --jolly-tree-indent: 10px;
    }

    jolly-tree::part(leaf) {
      margin-block: 1px;
      border: 1px solid var(--jolly-border);
      background: var(--jolly-surface-raised);
    }

    jolly-tree::part(leaf):hover {
      background: var(--jolly-control-bg-hover);
    }

    jolly-tree::part(selected) {
      background: var(--jolly-control-bg-active);
      font-weight: 600;
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
  declare preferences: Preferences | null;

  @property({ attribute: false })
  declare account: Account | null;

  @property({ attribute: false })
  declare signedIn: StudioSignedIn | null;

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  @property({ attribute: false })
  declare browserState: BrowserState;

  @state()
  declare _collapsed: ReadonlySet<string>;

  constructor() {
    super();
    this.sections = SettingsSections.EMPTY;
    this.preferences = null;
    this.account = null;
    this.signedIn = null;
    this.catalog = null;
    this.browserState = new BrowserState();
    this._collapsed = new Set();
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

    return html`
      <nav class="card" aria-label="Settings sections">
        <jolly-tree
          toggle-style="box"
          indent-guides
          require-selection
          .nodes=${this.sections.nodes}
          .selected=${current === undefined ? [] : [current.id]}
          .expanded=${this.sections.headings.filter(
            (id) => !this._collapsed.has(id)
          )}
          @jolly-select=${this.#onSelect}
          @jolly-toggle-expand=${this.#onToggleExpand}
        ></jolly-tree>
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
        <div class="card-body ${current?.kind === "preferences" ? "wide" : ""}">
          ${current === undefined ? nothing : this.#content(current)}
        </div>
      </section>
    `;
  }

  readonly #onSelect = (
    event: HTMLElementEventMap["jolly-select"]
  ): void => {
    const [id] = event.detail.selected;
    if (id !== undefined && this.sections.find(id) !== undefined) {
      this.section = id;
    }
  };

  readonly #onToggleExpand = (
    event: HTMLElementEventMap["jolly-toggle-expand"]
  ): void => {
    const { id, expanded } = event.detail;
    const collapsed = new Set(this._collapsed);
    if (expanded) {
      collapsed.delete(id);
    }
    else {
      collapsed.add(id);
    }
    this._collapsed = collapsed;
  };

  #content(
    section: SettingsSection
  ): TemplateResult | typeof nothing {
    switch (section.kind) {
      case "profile":
        return html`
          <studio-profile-settings
            .account=${this.account}
          ></studio-profile-settings>
        `;
      case "preferences":
        return html`
          <studio-preferences-page
            .forms=${section.forms}
            .keyBindings=${section.keyBindings}
            .shortcutScopes=${this.sections.shortcutScopes}
            .preferences=${this.preferences}
          ></studio-preferences-page>
        `;
      default:
        return this.signedIn === null ?
          nothing :
          this.#projectContent(section, this.signedIn);
    }
  }

  #projectContent(
    section: ProjectSection,
    signedIn: StudioSignedIn
  ): TemplateResult | typeof nothing {
    switch (section.kind) {
      case "share-links":
        return this.catalog === null ? nothing : html`
          <studio-share-links
            .links=${signedIn.shares}
            .catalog=${this.catalog}
          ></studio-share-links>
        `;
      case "general":
        return html`
          <studio-project-general
            .project=${signedIn.project}
          ></studio-project-general>
        `;
      case "kind-package":
        return html`${keyed(section.id, html`
          <studio-project-kind-package
            .project=${signedIn.project}
            .packageName=${section.packageName}
          ></studio-project-kind-package>
        `)}`;
      case "access":
        return html`
          <studio-access-settings
            .project=${signedIn.project}
            .signedIn=${signedIn}
          ></studio-access-settings>
        `;
      case "audit":
        return html`
          <studio-audit-view
            .signedIn=${signedIn}
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
