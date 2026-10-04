// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { AssetTally } from "../../catalog/AssetTally.ts";
import type { EditorTab } from "../../tabs/EditorTabs.ts";
import type {
  AssetBrowserOptions,
  AssetOpenDetail
} from "../assets/AssetBrowser.ts";

@customElement("project-overview")
export class ProjectOverview extends LitElement {
  @property({ attribute: false })
  declare options: AssetBrowserOptions | null;

  @property({ attribute: false })
  declare openTabs: readonly EditorTab[];

  @state()
  declare _tally: AssetTally;

  #catalog: CatalogClient | null = null;

  constructor() {
    super();
    this.options = null;
    this.openTabs = [];
    this._tally = AssetTally.EMPTY;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#listen();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unlisten();
    this.#catalog = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("options")) {
      this.#listen();
    }
  }

  override render(): TemplateResult {
    return html`
      <section class="tally" aria-labelledby="overview-assets">
        <h2 id="overview-assets">
          Assets <span class="total">${this._tally.total}</span>
        </h2>
        <ul>
          ${this._tally.rows.map((row) => html`
            <li data-kind=${row.kind}>
              <jolly-icon name=${row.icon}></jolly-icon>
              <span class="label">${row.label}</span>
              <span class="count">${row.count}</span>
            </li>
          `)}
        </ul>
      </section>
      <section class="open-editors" aria-labelledby="overview-editors">
        <h2 id="overview-editors">Open editors</h2>
        ${this.openTabs.length === 0
          ? html`<p class="empty">Double-click an asset to open its editor.</p>`
          : html`
            <ul>
              ${this.openTabs.map((tab) => html`
                <li>
                  <jolly-button
                    icon=${tab.icon ?? ""}
                    title=${tab.tooltip ?? nothing}
                    @click=${() => this.#open(tab.id)}
                  >${tab.label}</jolly-button>
                </li>
              `)}
            </ul>
          `}
      </section>
    `;
  }

  #listen(): void {
    const catalog = this.isConnected ? this.options?.catalog ?? null : null;
    if (catalog !== this.#catalog) {
      this.#unlisten();
      this.#catalog = catalog;
      this.#catalog?.on("change", this.#count);
    }
    this.#count();
  }

  #unlisten(): void {
    this.#catalog?.off("change", this.#count);
  }

  #open(
    assetId: string
  ): void {
    this.dispatchEvent(new CustomEvent<AssetOpenDetail>("asset-open", {
      bubbles: true,
      detail: { assetId }
    }));
  }

  readonly #count = (): void => {
    const tally = this.#catalog === null || this.options === null
      ? AssetTally.EMPTY
      : AssetTally.count(this.#catalog.records(), this.options.kinds);
    if (!tally.equals(this._tally)) {
      this._tally = tally;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "project-overview": ProjectOverview;
  }
}
