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
import type { CatalogShare } from "@jolly-pixel/editor.host";
import {
  LazyTemplate,
  LogQueue,
  type LogEntry
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetBrowserOptions } from "./assets/AssetBrowser.ts";
import { ChangeController } from "./ChangeController.ts";
import {
  STUDIO_USER_CHANGE,
  type StudioUser
} from "../accounts/StudioUser.ts";
import {
  SETTINGS_TAB_ID,
  StudioSession,
  type StudioSessionOptions
} from "./StudioSession.ts";
import type { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import { SettingsSections } from "./settings/SettingsSections.ts";
import { BrowserState } from "../browser/BrowserState.ts";
import type { StudioErrorEvent } from "./StudioErrorEvent.ts";
import type { EditorTab } from "../tabs/EditorTabs.ts";
import type { StudioSettings } from "./settings/StudioSettings.ts";
import "./home/StudioHome.ts";
import "./account/AccountBadge.ts";

export interface StudioOptions extends Pick<
  StudioSessionOptions,
  "editors" | "scopes" | "console" | "confirmEvict" | "confirmClose"
> {
  share: CatalogShare;
  user: StudioUser;
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

    #studio-settings {
      height: 100%;
    }

    #studio-settings[hidden] {
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
  declare _sections: SettingsSections;

  @query("jolly-tabs")
  declare _strip: HTMLElementTagNameMap["jolly-tabs"] | null;

  @query("#editor-frames")
  declare _frames: HTMLElement | null;

  @query("#studio-home")
  declare _home: HTMLElement | null;

  @query("#studio-settings")
  declare _settings: HTMLElement | null;

  @query("studio-settings")
  declare _settingsPage: StudioSettings | null;

  #session: StudioSession | null = null;
  #scopes: PreferenceScopes | null = null;
  #browserState = new BrowserState();
  #settingsPage = new LazyTemplate(
    this,
    () => import("./settings/StudioSettings.ts")
  );
  #queue = new LogQueue();
  #unsubscribe: (() => void) | null = null;
  #user = new ChangeController<StudioUser>(
    this,
    STUDIO_USER_CHANGE,
    (user) => [
      user.onPreferenceError((message) => this.#queue.push(message))
    ]
  );

  constructor() {
    super();
    this._assets = null;
    this._openTabs = [];
    this._log = [];
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
    const { share, user } = options;
    const { catalog } = share;
    const session = new StudioSession({
      catalog,
      share,
      user: user.online ? user : {
        identity: null,
        preferences: user.preferences,
        renewal: null
      },
      scopes: options.scopes,
      editors: options.editors,
      console: options.console,
      confirmEvict: options.confirmEvict,
      confirmClose: options.confirmClose,
      slots: {
        strip: this._strip,
        frames: this._frames,
        home: this._home,
        settings: this._settings
      },
      browserState: this.#browserState,
      onTabsChange: this.#syncOpenTabs
    });
    this.#session = session;
    this.#scopes = options.scopes;
    this._sections = options.settings;
    this.#user.attach(user);
    this._assets = {
      catalog,
      kinds: session.kinds,
      shares: user.online ? user.shares : null,
      browserState: this.#browserState
    };
    await session.restoreTabs();
    this.#syncOpenTabs();
  }

  openSettings(
    section?: string
  ): void {
    if (section !== undefined) {
      this.#browserState.settingsSection = section;
      this._settingsPage?.requestUpdate();
    }
    this.#session?.openSettings();
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
    this.#session?.dispose();
    this.#session = null;
  }

  override render(): TemplateResult {
    const user = this.#user.current;
    const account = user?.online ? user.account : null;

    return html`
      <header id="studio-header">
        <jolly-tabs id="editor-tabs" reorderable></jolly-tabs>
        <jolly-toolbar id="studio-actions" label="Studio actions">
          <studio-account
            .account=${account}
            .avatar=${account?.avatar ?? ""}
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
            .user=${user}
            .browserState=${this.#browserState}
            @studio-error=${this.#logError}
          ></studio-home>
          <div
            id="studio-settings"
            role="region"
            aria-label="Settings"
            hidden
          >${this.#settingsPage.render(() => html`
            <studio-settings
              .sections=${this._sections}
              .scopes=${this.#scopes}
              .user=${user}
              .catalog=${this._assets?.catalog ?? null}
              .browserState=${this.#browserState}
              @avatar-change=${this.#replaceAvatar}
            ></studio-settings>
          `)}</div>
        </div>
        <jolly-log .entries=${this._log}></jolly-log>
      </section>
    `;
  }

  readonly #signOut = (): void => {
    const user = this.#user.current;
    if (user?.online) {
      void user.signOut();
    }
  };

  readonly #replaceAvatar = async(
    event: HTMLElementEventMap["avatar-change"]
  ): Promise<void> => {
    const user = this.#user.current;
    if (!user?.online) {
      return;
    }

    try {
      await user.replaceAvatar(event.detail.image);
    }
    catch (error) {
      this.#queue.push(
        `Avatar not changed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  readonly #syncOpenTabs = (): void => {
    this._openTabs = this.#session?.tabs.list() ?? [];
    if (this.#session?.tabs.active === SETTINGS_TAB_ID) {
      void this.#settingsPage.ready().catch((error: unknown) => {
        this.#queue.push(
          `Settings failed to load: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }
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
