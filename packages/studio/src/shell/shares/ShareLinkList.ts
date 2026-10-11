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
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  SubscriptionController,
  showConfirm
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ShareLinkRow } from "../../shares/ShareLinkRow.ts";
import {
  SHARE_LINKS_CHANGE,
  type StudioShareLinks
} from "../../shares/StudioShareLinks.ts";

@customElement("share-link-list")
export class ShareLinkList extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    ul {
      display: grid;
      gap: var(--jolly-space-1, 4px);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2, 8px);
      padding: var(--jolly-space-1, 4px);
      border-radius: 2px;
      background: var(--jolly-surface-sunken);
    }

    .text {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    .asset {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta,
    .empty {
      margin: 0;
      color: var(--jolly-text-muted);
    }

    .error {
      margin: 0 0 var(--jolly-space-2, 8px);
      color: var(--jolly-danger);
    }
  `;

  @property({ attribute: false })
  declare assetId: string | undefined;

  @property({ type: Boolean, attribute: "show-asset" })
  declare showAsset: boolean;

  @state()
  declare _copied: string | null;

  #links = new SubscriptionController<StudioShareLinks>(this, (links) => {
    const repaint = () => this.requestUpdate();
    links.addEventListener(SHARE_LINKS_CHANGE, repaint);
    links.roster.on("change", repaint);

    return [
      () => links.removeEventListener(SHARE_LINKS_CHANGE, repaint),
      () => links.roster.off("change", repaint)
    ];
  });

  #catalog = new SubscriptionController<CatalogClient>(this, (catalog) => {
    const repaint = () => this.requestUpdate();
    catalog.on("change", repaint);

    return [
      () => catalog.off("change", repaint)
    ];
  });

  constructor() {
    super();
    this.assetId = undefined;
    this.showAsset = false;
    this._copied = null;
  }

  set links(
    links: StudioShareLinks
  ) {
    this.#links.attach(links);
  }

  set catalog(
    catalog: CatalogClient
  ) {
    this.#catalog.attach(catalog);
  }

  async copy(
    linkId: string
  ): Promise<boolean> {
    const row = this.#rows().find((candidate) => candidate.id === linkId);
    if (row === undefined) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(row.url);
    }
    catch {
      return false;
    }
    this._copied = row.id;

    return true;
  }

  override render(): TemplateResult {
    const error = this.#links.current?.error ?? null;
    const rows = this.#rows();

    return html`
      ${error === null ? nothing : html`
        <p class="error" role="alert">${error}</p>
      `}
      ${rows.length === 0 ? html`
        <p class="empty">No active link.</p>
      ` : html`
        <ul aria-label="Share links">
          ${rows.map((row) => this.#renderRow(row))}
        </ul>
      `}
    `;
  }

  #rows(): ShareLinkRow[] {
    const links = this.#links.current;
    const catalog = this.#catalog.current;

    return links === null || catalog === null ?
      [] :
      links.rows(catalog, this.assetId);
  }

  #renderRow(
    row: ShareLinkRow
  ): TemplateResult {
    return html`
      <li data-link=${row.id}>
        <div class="text">
          ${this.showAsset ? html`
            <span class="asset" title=${row.asset}>${row.asset}</span>
          ` : nothing}
          <span class="meta">
            By ${row.creator} on ${row.created}. ${row.expires}.
          </span>
        </div>
        <jolly-button
          data-action="copy"
          title=${row.url}
          @click=${() => this.copy(row.id)}
        >${this._copied === row.id ? "Copied" : "Copy link"}</jolly-button>
        <jolly-button
          variant="danger"
          data-action="revoke"
          @click=${() => this.#revoke(row)}
        >Revoke</jolly-button>
      </li>
    `;
  }

  async #revoke(
    row: ShareLinkRow
  ): Promise<void> {
    const confirmed = await showConfirm({
      title: "Revoke link?",
      message: "Guests viewing it are disconnected, and the link stops working for good.",
      confirmLabel: "Revoke",
      danger: true
    });
    if (confirmed) {
      await this.#links.current?.revoke(row.id);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "share-link-list": ShareLinkList;
  }
}
