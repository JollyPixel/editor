// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import type { Account } from "@jolly-pixel/accounts";
import {
  FrameConsoles,
  type CatalogShare,
  type EditorConsole
} from "@jolly-pixel/editor.host";
import type { Preferences } from "@jolly-pixel/editor.host/preferences";
import {
  LogQueue,
  type LogEntry
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetBrowserOptions } from "./assets/AssetBrowser.ts";
import {
  SIGNED_IN_CHANGE,
  type StudioSignedIn
} from "../accounts/StudioSignedIn.ts";
import { StudioSession } from "./StudioSession.ts";
import type { PreferenceScopes } from "../preferences/PreferenceScopes.ts";
import { SettingsSections } from "./settings/SettingsSections.ts";
import type { EditorRegistry } from "../editors/EditorRegistry.ts";
import { BrowserState } from "../browser/BrowserState.ts";
import { SETTINGS_TAB_ID } from "./settings/StudioSettings.ts";
import type { StudioErrorEvent } from "./StudioErrorEvent.ts";
import type {
  EditorTab,
  EditorTabsOptions
} from "../tabs/EditorTabs.ts";
import "./home/StudioHome.ts";
import "./settings/StudioSettings.ts";
import "./account/AccountBadge.ts";

export interface StudioOptions {
  share: CatalogShare;
  confirmEvict?: EditorTabsOptions["confirmEvict"];
  editors: EditorRegistry;
  console?: EditorConsole;
  signedIn?: StudioSignedIn | null;
  preferences: Preferences;
  scopes: PreferenceScopes;
  settings: SettingsSections;
}

@customElement("jolly-studio")
export class Studio extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      background: var(--studio-window);
      color: var(--jolly-text);
      font-family: var(--jolly-font-family);
      font-size: var(--jolly-font-size);

      --studio-gutter: var(--jolly-space-2);
      --studio-gutter-tight: var(--jolly-space-1);
      --studio-radius: var(--jolly-radius-md);
      --studio-window: light-dark(
        var(--jolly-surface-sunken),
        color-mix(in oklab, var(--jolly-surface-sunken), black 12%)
      );
      --studio-board: var(--jolly-surface);
      --studio-card: color-mix(
        in oklab,
        var(--jolly-surface),
        var(--jolly-surface-raised)
      );
      --studio-card-head-height: 36px;
      --studio-light: light-dark(
        rgb(255 255 255 / 70%),
        rgb(255 255 255 / 5%)
      );
      --studio-shade: light-dark(rgb(0 0 0 / 7%), rgb(0 0 0 / 30%));
      --studio-bevel:
        inset 0 1px 0 var(--studio-light),
        inset 0 -1px 0 var(--studio-shade);
    }

    #studio-header {
      display: flex;
      flex: 0 0 auto;
      align-items: flex-end;
      gap: var(--studio-gutter);
      padding: var(--studio-gutter) var(--studio-gutter) 0;
    }

    #editor-tabs {
      flex: 1 1 auto;
      min-width: 0;

      --jolly-control-height: 34px;
      --jolly-tab-icon-size: 20px;
      --jolly-tab-close-size: 20px;
      --jolly-tab-close-icon-size: 12px;
    }

    #editor-tabs::part(list) {
      gap: 2px;
    }

    #editor-tabs::part(tab) {
      border-radius: var(--studio-radius) var(--studio-radius) 0 0;
      background: color-mix(in oklab, var(--studio-board) 50%, transparent);
      color: var(--jolly-text-muted);
    }

    #editor-tabs::part(tab):hover {
      background: color-mix(in oklab, var(--studio-board) 80%, transparent);
      color: var(--jolly-text);
    }

    #editor-tabs::part(tab-selected),
    #editor-tabs::part(tab-selected):hover {
      background: var(--studio-board);
      color: var(--jolly-text);
      box-shadow: inset 0 1px 0 var(--studio-light);
    }

    #editor-tabs::part(tab-selected)::after {
      background: transparent;
    }

    #editor-tabs::part(tab-dragging),
    #editor-tabs::part(tab-dragging):hover {
      background: var(--studio-board);
      color: var(--jolly-text);
      box-shadow:
        inset 0 1px 0 var(--studio-light),
        var(--jolly-shadow-floating);
    }

    #editor-tabs::part(close) {
      margin-inline: 4px;
    }

    #studio-actions {
      flex: 0 0 auto;
      margin-block-end: 2px;
    }

    #workbench {
      position: relative;
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      margin: 0 var(--studio-gutter) var(--studio-gutter);
      padding: var(--studio-gutter);
      overflow: hidden;
      border-radius: 0 var(--studio-radius) var(--studio-radius);
      background: var(--studio-board);
      box-shadow: inset 0 -1px 0 var(--studio-shade);
    }

    #workbench:has(#editor-frames > iframe:not([hidden])) {
      margin: 0 var(--studio-gutter-tight) var(--studio-gutter-tight);
      padding: var(--studio-gutter-tight);
      border-radius: var(--studio-radius);
    }

    #editor-frames {
      position: relative;
      flex: 1;
      min-height: 0;
    }

    #editor-frames:has(> iframe:not([hidden]))::after {
      position: absolute;
      inset: 0;
      border-radius: var(--studio-radius);
      box-shadow: 0 0 0 calc(var(--studio-radius) / 2) var(--studio-board);
      content: "";
      pointer-events: none;
    }

    #editor-frames iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }

    #editor-frames iframe[hidden] {
      display: none;
    }

    jolly-log {
      position: absolute;
      inset-block-end: calc(var(--studio-gutter) * 3);
      inset-inline-start: calc(var(--studio-gutter) * 3);
    }
  `;

  @state()
  declare _assets: AssetBrowserOptions | null;

  @state()
  declare _openTabs: readonly EditorTab[];

  @state()
  declare _log: readonly LogEntry[];

  @state()
  declare _signedIn: StudioSignedIn | null;

  @state()
  declare _account: Account | null;

  @state()
  declare _preferences: Preferences | null;

  @state()
  declare _sections: SettingsSections;

  @query("jolly-tabs")
  declare _strip: HTMLElementTagNameMap["jolly-tabs"] | null;

  @query("#editor-frames")
  declare _frames: HTMLElement | null;

  @query("#studio-home")
  declare _home: HTMLElement | null;

  @query("#studio-settings")
  declare _settings: HTMLElementTagNameMap["studio-settings"] | null;

  #session: StudioSession | null = null;
  #browserState = new BrowserState();
  #queue = new LogQueue();
  #unsubscribe: (() => void) | null = null;
  #stopPreferenceErrors: (() => void) | null = null;

  constructor() {
    super();
    this._assets = null;
    this._openTabs = [];
    this._log = [];
    this._signedIn = null;
    this._account = null;
    this._preferences = null;
    this._sections = SettingsSections.EMPTY;
  }

  async attach(
    options: StudioOptions
  ): Promise<void> {
    await this.updateComplete;
    if (
      this._strip === null ||
      this._frames === null ||
      this._home === null ||
      this._settings === null
    ) {
      throw new Error("The studio must be connected before it is attached.");
    }

    this.#session?.dispose();
    const { catalog } = options.share;
    const signedIn = options.signedIn ?? null;
    const session = new StudioSession({
      catalog,
      editors: options.editors,
      browserState: this.#browserState,
      tabs: {
        strip: this._strip,
        home: this._home,
        pages: [
          {
            id: SETTINGS_TAB_ID,
            label: "Settings",
            icon: "settings",
            element: this._settings
          }
        ],
        confirmEvict: options.confirmEvict
      },
      frames: {
        container: this._frames,
        share: options.share,
        identity: () => signedIn?.identity ?? null,
        consoles: options.console === undefined ?
          undefined :
          new FrameConsoles({ commands: options.console.commands })
      },
      preferences: {
        values: options.preferences,
        scopes: options.scopes
      },
      onTabsChange: this.#syncOpenTabs,
      console: options.console?.element,
      renewal: signedIn?.renewal
    });
    this.#session = session;
    this._preferences = options.preferences;
    this._sections = options.settings;
    this.#follow(signedIn);
    this._assets = {
      catalog,
      kinds: session.kinds,
      shares: signedIn?.shares ?? null,
      browserState: this.#browserState
    };
    await session.restoreTabs();
    this.#syncOpenTabs();
  }

  openSettings(
    section?: string
  ): void {
    if (section !== undefined && this._settings !== null) {
      this._settings.section = section;
    }
    this.#session?.tabs.openPage(SETTINGS_TAB_ID);
  }

  reloadEditor(
    name: string
  ): void {
    this.#session?.reloadEditor(name);
  }

  openAsset(
    assetId: string
  ): Promise<boolean> {
    return this.#session?.openAsset(
      assetId
    ) ?? Promise.resolve(false);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._log = this.#queue.entries;
    this.#unsubscribe = this.#queue.subscribe((entries) => {
      this._log = entries;
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#follow(null);
    this.#session?.dispose();
    this.#session = null;
  }

  override render(): TemplateResult {
    return html`
      <header id="studio-header">
        <jolly-tabs id="editor-tabs" reorderable></jolly-tabs>
        <jolly-toolbar id="studio-actions" label="Studio actions">
          <studio-account
            .account=${this._account}
            .avatar=${this._account?.avatar ?? ""}
            @sign-out=${this.#signOut}
            @settings-open=${this.#openSettings}
          ></studio-account>
        </jolly-toolbar>
      </header>
      <section id="workbench">
        <div id="editor-frames">
          <studio-home
            id="studio-home"
            role="region"
            aria-label="Home"
            .assets=${this._assets}
            .openTabs=${this._openTabs}
            @asset-open=${this.#onAssetOpen}
            @console-toggle=${this.#toggleConsole}
            @settings-open=${this.#openSettings}
            .signedIn=${this._signedIn}
            .account=${this._account}
            .browserState=${this.#browserState}
            @studio-error=${this.#logError}
          ></studio-home>
          <studio-settings
            id="studio-settings"
            role="region"
            aria-label="Settings"
            hidden
            .sections=${this._sections}
            .preferences=${this._preferences}
            .account=${this._account}
            @avatar-change=${this.#replaceAvatar}
          ></studio-settings>
        </div>
        <jolly-log .entries=${this._log}></jolly-log>
      </section>
    `;
  }

  #follow(
    signedIn: StudioSignedIn | null
  ): void {
    this._signedIn?.removeEventListener(SIGNED_IN_CHANGE, this.#syncAccount);
    this._signedIn = signedIn;
    signedIn?.addEventListener(SIGNED_IN_CHANGE, this.#syncAccount);
    this.#stopPreferenceErrors?.();
    this.#stopPreferenceErrors = signedIn?.preferences.onError(
      (message) => this.#queue.push(message)
    ) ?? null;
    this.#syncAccount();
  }

  readonly #syncAccount = (): void => {
    this._account = this._signedIn?.account ?? null;
  };

  readonly #signOut = (): void => {
    void this._signedIn?.signOut();
  };

  readonly #replaceAvatar = async(
    event: HTMLElementEventMap["avatar-change"]
  ): Promise<void> => {
    try {
      await this._signedIn?.replaceAvatar(event.detail.image);
    }
    catch (error) {
      this.#queue.push(
        `Avatar not changed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  readonly #syncOpenTabs = (): void => {
    this._openTabs = this.#session?.tabs.list() ?? [];
  };

  readonly #toggleConsole = (): void => {
    this.#session?.toggleConsole();
  };

  readonly #openSettings = (): void => {
    this.openSettings();
  };

  readonly #onAssetOpen = (
    event: HTMLElementEventMap["asset-open"]
  ): void => {
    void this.openAsset(event.detail.assetId);
  };

  readonly #logError = (
    event: StudioErrorEvent
  ): void => {
    this.#queue.push(event.detail.message);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-studio": Studio;
  }
}
