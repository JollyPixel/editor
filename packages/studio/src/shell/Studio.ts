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
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  LogQueue,
  type LogEntry
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetBrowserOptions } from "./assets/AssetBrowser.ts";
import { StudioSession } from "./StudioSession.ts";
import type { EditorRegistry } from "../editors/EditorRegistry.ts";
import type { EditorTabsOptions } from "../tabs/EditorTabs.ts";
import "./assets/AssetBrowser.ts";

export interface StudioOptions {
  catalog: CatalogClient;
  confirmEvict?: EditorTabsOptions["confirmEvict"];
  editors: EditorRegistry;
}

@customElement("jolly-studio")
export class Studio extends LitElement {
  @state()
  declare _assets: AssetBrowserOptions | null;

  @state()
  declare _log: readonly LogEntry[];

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
    this._log = [];
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
    const session = new StudioSession({
      catalog: options.catalog,
      editors: options.editors,
      tabs: {
        strip: this._strip,
        frames: this._frames,
        home: this._home,
        confirmEvict: options.confirmEvict
      }
    });
    this.#session = session;
    this._assets = {
      catalog: options.catalog,
      kinds: session.kinds
    };
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
        <jolly-toolbar id="studio-actions" label="Studio actions"></jolly-toolbar>
      </header>
      <div id="studio-main">
        <jolly-dock-layout storage-key="studio:layout">
          <jolly-dock
            id="asset-dock"
            key="left"
            side="left"
            collapsible
            size="280"
            min-size="200"
            max-size="480"
          >
            <jolly-pane key="assets" heading="Assets" icon="folder" locked>
              <asset-browser
                .options=${this._assets}
                @asset-open=${this.#onAssetOpen}
                @asset-error=${this.#onAssetError}
              ></asset-browser>
            </jolly-pane>
          </jolly-dock>
          <section id="workbench">
            <div id="editor-frames">
              <section id="studio-home" aria-label="Home"></section>
            </div>
            <jolly-log .entries=${this._log}></jolly-log>
          </section>
        </jolly-dock-layout>
      </div>
    `;
  }

  readonly #onAssetOpen = (
    event: HTMLElementEventMap["asset-open"]
  ): void => {
    void this.openAsset(event.detail.assetId);
  };

  readonly #onAssetError = (
    event: HTMLElementEventMap["asset-error"]
  ): void => {
    this.#queue.push(event.detail.message);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-studio": Studio;
  }
}
