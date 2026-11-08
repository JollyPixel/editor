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
  property
} from "lit/decorators.js";
import type { IconName } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";

// Import Internal Dependencies
import {
  NO_ASSET_SUMMARY,
  type AssetSummary
} from "../../catalog/AssetSummary.ts";
import { cardStyles } from "../cardStyles.ts";
import { assetOpenEvent } from "./assetOpen.ts";
import type { AssetPreviewCache } from "./AssetPreviewCache.ts";
import "./AssetPreview.ts";

// CONSTANTS
const kSelectionIcon: IconName = "file";

@customElement("asset-details")
export class AssetDetails extends LitElement {
  static override styles = [
    cardStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
      }

      .card-head {
        --jolly-control-height: 20px;
      }

      .title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .card-body {
        display: flex;
        flex-direction: column;
        gap: var(--jolly-space-2);
        padding-block-start: 0;
      }

      asset-preview {
        flex: 0 0 auto;
      }

      .meta {
        min-height: 1lh;
        margin: 0;
        overflow: hidden;
        color: var(--jolly-text-muted);
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `
  ];

  @property({ attribute: false })
  declare summary: AssetSummary;

  @property({ attribute: false })
  declare previews: AssetPreviewCache | null;

  constructor() {
    super();
    this.summary = NO_ASSET_SUMMARY;
    this.previews = null;
  }

  override render(): TemplateResult {
    const heading = cardHeading(this.summary);

    return html`
      <div class="card-head">
        <h2 class="card-title" id="asset-details-title">
          <span class="title" title=${heading}>${heading}</span>
        </h2>
        ${this.#action()}
      </div>
      <section class="card-body" aria-labelledby="asset-details-title">
        ${this.#frame()}
        ${renderMeta(this.summary)}
      </section>
    `;
  }

  #frame(): TemplateResult {
    const { summary } = this;
    switch (summary.subject) {
      case "none":
        return html`
          <asset-preview icon=${kSelectionIcon}>
            Select an asset to see its details.
          </asset-preview>
        `;
      case "many":
        return html`<asset-preview icon=${kSelectionIcon}></asset-preview>`;
      case "folder":
        return html`<asset-preview icon=${summary.icon}></asset-preview>`;
      case "asset":
        return html`
          <asset-preview
            .previews=${summary.preview === null ? null : this.previews}
            .target=${summary.preview}
            icon=${summary.icon}
          ></asset-preview>
        `;
    }
  }

  #action(): TemplateResult | typeof nothing {
    const { summary } = this;
    const assetId = summary.subject === "asset" ?
      summary.editableAssetId :
      null;

    return assetId === null ?
      nothing :
      html`
        <jolly-button
          variant="accent"
          title="Open in editor"
          @click=${() => this.#open(assetId)}
        >Open</jolly-button>
      `;
  }

  #open(
    assetId: string
  ): void {
    this.dispatchEvent(assetOpenEvent(assetId));
  }
}

function cardHeading(
  summary: AssetSummary
): string {
  switch (summary.subject) {
    case "none":
      return "Details";
    case "many":
      return `${summary.count} items selected`;
    default:
      return summary.title;
  }
}

function renderMeta(
  summary: AssetSummary
): TemplateResult {
  if (summary.subject === "none" || summary.subject === "many") {
    return html`<p class="meta"></p>`;
  }

  const meta = `${summary.kindLabel} · ${summary.location}`;

  return html`<p class="meta" title=${meta}>${meta}</p>`;
}

declare global {
  interface HTMLElementTagNameMap {
    "asset-details": AssetDetails;
  }
}
