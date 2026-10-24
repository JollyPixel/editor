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
  property
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/toolbar";

// Import Internal Dependencies
import type { StudioShareLinks } from "../../shares/StudioShareLinks.ts";
import "./ShareLinkList.ts";

@customElement("studio-share-links")
export class ShareLinksPane extends LitElement {
  static override styles = css`
    :host {
      display: grid;
      gap: var(--jolly-space-2, 8px);
      padding: var(--jolly-space-2, 8px);
    }
  `;

  @property({ attribute: false })
  declare links: StudioShareLinks | null;

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  constructor() {
    super();
    this.links = null;
    this.catalog = null;
  }

  override updated(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("links")) {
      void this.links?.load();
    }
  }

  override render(): TemplateResult {
    if (this.links === null || this.catalog === null) {
      return html`${nothing}`;
    }

    return html`
      <jolly-toolbar label="Share link actions">
        <jolly-button
          data-action="refresh"
          @click=${this.#refresh}
        >Refresh</jolly-button>
      </jolly-toolbar>
      <share-link-list
        show-asset
        .links=${this.links}
        .catalog=${this.catalog}
      ></share-link-list>
    `;
  }

  readonly #refresh = (): void => {
    void this.links?.load();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-share-links": ShareLinksPane;
  }
}
