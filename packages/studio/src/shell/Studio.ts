// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import {
  FrameConsoles,
  type CatalogShare,
  type EditorConsole
} from "@jolly-pixel/editor.host";
import {
  LogQueue,
  type LogEntry,
  type PeerIdentity
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetBrowserOptions } from "./assets/AssetBrowser.ts";
import type { StudioSignedIn } from "../accounts/StudioSignedIn.ts";
import { StudioSession } from "./StudioSession.ts";
import type { EditorRegistry } from "../editors/EditorRegistry.ts";
import type {
  EditorTab,
  EditorTabsOptions
} from "../tabs/EditorTabs.ts";
import "./home/StudioHome.ts";
import "./account/AccountBadge.ts";

export interface StudioOptions {
  share: CatalogShare;
  identity: PeerIdentity | null;
  confirmEvict?: EditorTabsOptions["confirmEvict"];
  editors: EditorRegistry;
  console?: EditorConsole;
  signedIn?: StudioSignedIn | null;
}

@customElement("jolly-studio")
export class Studio extends LitElement {
  @state()
  declare _assets: AssetBrowserOptions | null;

  @state()
  declare _openTabs: readonly EditorTab[];

  @state()
  declare _log: readonly LogEntry[];

  @state()
  declare _signedIn: StudioSignedIn | null;

  @query("jolly-tabs")
  declare _strip: HTMLElementTagNameMap["jolly-tabs"] | null;

  @query("#editor-frames")
  declare _frames: HTMLElement | null;

  @query("#studio-home")
  declare _home: HTMLElement | null;

  #session: StudioSession | null = null;
  #queue = new LogQueue();
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this._assets = null;
    this._openTabs = [];
    this._log = [];
    this._signedIn = null;
  }

  async attach(
    options: StudioOptions
  ): Promise<void> {
    await this.updateComplete;
    if (
      this._strip === null ||
      this._frames === null ||
      this._home === null
    ) {
      throw new Error("The studio must be connected before it is attached.");
    }

    this.#session?.dispose();
    const { catalog } = options.share;
    const session = new StudioSession({
      catalog,
      editors: options.editors,
      tabs: {
        strip: this._strip,
        home: this._home,
        confirmEvict: options.confirmEvict
      },
      frames: {
        container: this._frames,
        share: options.share,
        identity: options.identity,
        consoles: options.console === undefined ?
          undefined :
          new FrameConsoles({ commands: options.console.commands })
      },
      onTabsChange: this.#syncOpenTabs,
      onToggleConsole: () => {
        options.console?.element.toggle();
      }
    });
    this.#session = session;
    this._signedIn = options.signedIn ?? null;
    this._assets = {
      catalog,
      kinds: session.kinds
    };
    await session.restoreTabs();
    this.#syncOpenTabs();
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

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <header id="studio-header">
        <jolly-tabs id="editor-tabs" reorderable></jolly-tabs>
        <jolly-toolbar id="studio-actions" label="Studio actions">
          <studio-account
            .account=${this._signedIn?.account ?? null}
            @sign-out=${this.#signOut}
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
            .signedIn=${this._signedIn}
            @asset-error=${this.#logError}
            @users-error=${this.#logError}
          ></studio-home>
        </div>
        <jolly-log .entries=${this._log}></jolly-log>
      </section>
    `;
  }

  readonly #signOut = (): void => {
    void this._signedIn?.signOut();
  };

  readonly #syncOpenTabs = (): void => {
    this._openTabs = this.#session?.tabs.list() ?? [];
  };

  readonly #onAssetOpen = (
    event: HTMLElementEventMap["asset-open"]
  ): void => {
    void this.openAsset(event.detail.assetId);
  };

  readonly #logError = (
    event: HTMLElementEventMap["asset-error" | "users-error"]
  ): void => {
    this.#queue.push(event.detail.message);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-studio": Studio;
  }
}
