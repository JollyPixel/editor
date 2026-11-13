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
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/icon";
import "@jolly-pixel/ui/elements/message";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";

// Import Internal Dependencies
import { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import type { ShareLinkRow } from "../../shares/ShareLinkRow.ts";
import type { StudioShareLinks } from "../../shares/StudioShareLinks.ts";
import { RemoteStateController } from "../RemoteStateController.ts";
import { listRowStyles } from "../listRowStyles.ts";

// CONSTANTS
const kMissingAssetIcon = "file";

@customElement("share-link-list")
export class ShareLinkList extends LitElement {
  static override styles = [listRowStyles, css`
    :host {
      display: block;
    }
  `];

  @property({ attribute: false })
  declare assetId: string | undefined;

  @property({ attribute: false })
  declare kinds: AssetKindSet;

  @property({ type: Boolean, attribute: "show-asset" })
  declare showAsset: boolean;

  @state()
  declare _copied: string | null;

  #links = new RemoteStateController<StudioShareLinks>(this, (links) => {
    const repaint = () => this.requestUpdate();
    links.roster.on("change", repaint);

    return [
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
    this.kinds = AssetKindSet.EMPTY;
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
    const rows = this.#rows();

    return html`
      ${this.#links.error()}
      ${rows.length === 0 ? html`
        <jolly-message flush>No active link.</jolly-message>
      ` : html`
        <ul class="rows" aria-label="Share links">
          ${rows.map((row) => this.#renderRow(row))}
        </ul>
      `}
    `;
  }

  #assetIcon(
    row: ShareLinkRow
  ): TemplateResult {
    return html`
      <jolly-icon
        name=${row.kind === null ? kMissingAssetIcon : this.kinds.kindIcon(row.kind)}
      ></jolly-icon>
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
        ${this.showAsset ? this.#assetIcon(row) : nothing}
        <div class="row-text">
          ${this.showAsset ? html`
            <span class="row-title" title=${row.asset}>${row.asset}</span>
          ` : nothing}
          <span class="row-meta">
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
