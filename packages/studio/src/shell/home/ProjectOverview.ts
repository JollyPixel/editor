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
  state
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/icon";

// Import Internal Dependencies
import { AssetTally } from "../../catalog/AssetTally.ts";
import type { EditorTab } from "../../tabs/EditorTabs.ts";
import { cardStyles } from "../cardStyles.ts";
import type { AssetBrowserOptions } from "../assets/AssetBrowser.ts";
import { assetOpenEvent } from "../assets/assetOpen.ts";

@customElement("project-overview")
export class ProjectOverview extends LitElement {
  static override styles = [
    cardStyles,
    css`
      :host {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: var(--studio-gutter);
        min-width: 0;
        min-height: 0;
      }

      .tally {
        flex: 0 0 auto;
      }

      .open-editors {
        flex: 1 1 auto;
      }

      .total {
        color: var(--jolly-text-muted);
        font-variant-numeric: tabular-nums;
        font-weight: 400;
      }

      ul {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: var(--jolly-space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .tally li {
        display: flex;
        align-items: center;
        gap: var(--jolly-space-3);
        padding: var(--jolly-space-2) var(--jolly-space-3);
        border-radius: var(--jolly-radius-sm);
        background: var(--jolly-surface-raised);
        box-shadow: var(--studio-bevel);

        --jolly-icon-size: 28px;
      }

      .tally .label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tally .count {
        font-variant-numeric: tabular-nums;
        font-size: 1.4em;
      }

      .open-editors jolly-button {
        display: flex;
        width: 100%;
      }

      .empty {
        margin: 0;
        color: var(--jolly-text-muted);
      }
    `
  ];

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

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("options")) {
      this.#listen();
    }
  }

  override render(): TemplateResult {
    return html`
      <section class="card tally" aria-labelledby="overview-assets">
        <div class="card-head">
          <h2 class="card-title" id="overview-assets">
            Assets <span class="total">${this._tally.total}</span>
          </h2>
        </div>
        <div class="card-body">
          <ul>
            ${this._tally.rows.map((row) => html`
              <li data-kind=${row.kind}>
                <jolly-icon name=${row.icon}></jolly-icon>
                <span class="label">${row.label}</span>
                <span class="count">${row.count}</span>
              </li>
            `)}
          </ul>
        </div>
      </section>
      <section class="card open-editors" aria-labelledby="overview-editors">
        <div class="card-head">
          <h2 class="card-title" id="overview-editors">Open editors</h2>
        </div>
        <div class="card-body">
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
        </div>
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
    this.dispatchEvent(assetOpenEvent(assetId));
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
