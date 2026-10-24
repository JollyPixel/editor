// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/icon";

// Import Internal Dependencies
import {
  NO_ASSET_SUMMARY,
  type AssetFileSummary,
  type AssetIdentity,
  type AssetSummary
} from "../../catalog/AssetSummary.ts";
import { cardStyles } from "../cardStyles.ts";
import { assetOpenEvent } from "./assetOpen.ts";

@customElement("asset-details")
export class AssetDetails extends LitElement {
  static override styles = [
    cardStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
      }

      .card-body {
        display: flex;
        flex-direction: column;
        gap: var(--jolly-space-3);
      }

      .identity {
        display: flex;
        align-items: center;
        gap: var(--jolly-space-3);

        --jolly-icon-size: 32px;
      }

      .names {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .title {
        overflow: hidden;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .muted,
      .empty {
        color: var(--jolly-text-muted);
      }

      .empty {
        display: grid;
        flex: 1;
        margin: 0;
        place-items: center;
        text-align: center;
      }

      dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--jolly-space-1) var(--jolly-space-3);
        margin: 0;
      }

      dt {
        color: var(--jolly-text-muted);
      }

      dd {
        min-width: 0;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      jolly-button {
        display: flex;
      }
    `
  ];

  @property({ attribute: false })
  declare summary: AssetSummary;

  constructor() {
    super();
    this.summary = NO_ASSET_SUMMARY;
  }

  override render(): TemplateResult {
    return html`
      <div class="card-head">
        <h2 class="card-title" id="asset-details-title">Details</h2>
      </div>
      <section class="card-body" aria-labelledby="asset-details-title">
        ${this.#body()}
      </section>
    `;
  }

  #body(): TemplateResult {
    const { summary } = this;
    switch (summary.subject) {
      case "none":
        return html`<p class="empty">Select an asset to see its details.</p>`;
      case "many":
        return html`<p class="empty">${summary.count} items selected</p>`;
      case "folder":
        return renderIdentity(summary);
      case "asset":
        return html`${renderIdentity(summary)}${this.#action(summary)}`;
    }
  }

  #action(
    summary: AssetFileSummary
  ): TemplateResult {
    const assetId = summary.editableAssetId;

    return assetId === null ?
      html`<p class="muted">No editor opens this kind.</p>` :
      html`
        <jolly-button
          variant="accent"
          @click=${() => this.#open(assetId)}
        >Open in editor</jolly-button>
      `;
  }

  #open(
    assetId: string
  ): void {
    this.dispatchEvent(assetOpenEvent(assetId));
  }
}

function renderIdentity(
  identity: AssetIdentity
): TemplateResult {
  return html`
    <div class="identity">
      <jolly-icon name=${identity.icon}></jolly-icon>
      <div class="names">
        <span class="title" title=${identity.title}>${identity.title}</span>
        <span class="muted">${identity.kindLabel}</span>
      </div>
    </div>
    <dl>
      <dt>Location</dt>
      <dd title=${identity.location}>${identity.location}</dd>
    </dl>
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "asset-details": AssetDetails;
  }
}
