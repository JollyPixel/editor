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
import type { CatalogClient } from "@jolly-pixel/asset-server/catalog/client";
import type { ShellCommand } from "@jolly-pixel/editor.host";
import {
  LogQueue,
  type LogEntry
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetBrowserOptions } from "./assets/AssetBrowser.ts";
import { AssetPath } from "../catalog/AssetPath.ts";
import type { EditorRegistry } from "../editors/EditorRegistry.ts";
import {
  EditorTabs,
  type EditorTabsOptions
} from "../tabs/EditorTabs.ts";
import "./assets/AssetBrowser.ts";

// CONSTANTS
const kNoEditorDetail = "no editor";

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

  #catalog: CatalogClient | null = null;
  #editors: EditorRegistry | null = null;
  #tabs: EditorTabs | null = null;
  #queue = new LogQueue();
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this._assets = null;
    this._log = [];
  }

  get tabs(): EditorTabs | null {
    return this.#tabs;
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

    this.#catalog = options.catalog;
    this.#editors = options.editors;
    this.#tabs = new EditorTabs({
      strip: this._strip,
      frames: this._frames,
      home: this._home,
      confirmEvict: options.confirmEvict,
      onShellCommand: this.#onShellCommand
    });
    this.#catalog.on("change", this.#syncTabs);
    this._assets = {
      catalog: options.catalog,
      iconFor: (kind) => options.editors.iconFor(kind),
      detailFor: (kind) => (this.canOpen(kind) ? undefined : kNoEditorDetail),
      kinds: options.editors.kinds().map(({ kind, label }) => {
        return {
          kind,
          label,
          icon: options.editors.iconFor(kind)
        };
      })
    };
  }

  canOpen(
    kind: string
  ): boolean {
    return this.#editors?.editorFor(kind) !== undefined;
  }

  openAsset(
    assetId: string
  ): Promise<boolean> {
    const record = this.#catalog?.record(assetId);
    const url = record === undefined ?
      undefined :
      this.#editors?.pageUrl(record.kind, assetId);
    if (this.#tabs === null || record === undefined || url === undefined) {
      return Promise.resolve(false);
    }

    return this.#tabs.open({
      id: assetId,
      label: AssetPath.parse(record.source).name,
      url,
      icon: this.#editors?.iconFor(record.kind)
    });
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
    this.#catalog?.off("change", this.#syncTabs);
    this.#tabs?.dispose();
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

  readonly #onShellCommand = (
    command: ShellCommand
  ): void => {
    if (command.command === "open-asset") {
      void this.openAsset(command.target);
    }
  };

  readonly #syncTabs = (): void => {
    for (const assetId of this.#tabs?.ids() ?? []) {
      const record = this.#catalog?.record(assetId);
      if (record === undefined) {
        this.#tabs?.close(assetId);
      }
      else {
        this.#tabs?.relabel(assetId, AssetPath.parse(record.source).name);
      }
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-studio": Studio;
  }
}
