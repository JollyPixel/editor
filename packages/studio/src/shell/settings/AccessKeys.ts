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
import "@jolly-pixel/ui/elements/separator";

// Import Internal Dependencies
import { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import type { StudioAgentTokens } from "../../golem/StudioAgentTokens.ts";
import type { StudioShareLinks } from "../../shares/StudioShareLinks.ts";
import { settingsStyles } from "./settingsStyles.ts";
import "../golem/AgentTokensPane.ts";
import "../shares/ShareLinkList.ts";

@customElement("studio-access-keys")
export class AccessKeys extends LitElement {
  static override styles = [settingsStyles, css`
    :host {
      gap: var(--jolly-space-4);
    }

    section {
      gap: var(--jolly-space-2);
    }

    p {
      margin: 0;
      color: var(--jolly-text-muted);
    }
  `];

  @property({ attribute: false })
  declare tokens: StudioAgentTokens | null;

  @property({ attribute: false })
  declare links: StudioShareLinks | null;

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  @property({ attribute: false })
  declare kinds: AssetKindSet;

  constructor() {
    super();
    this.tokens = null;
    this.links = null;
    this.catalog = null;
    this.kinds = AssetKindSet.EMPTY;
  }

  override updated(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("links")) {
      void this.links?.load();
    }
  }

  override render(): TemplateResult {
    return html`
      ${this.tokens === null ? nothing : html`
        <section aria-label="Agent tokens">
          <jolly-separator label="Agent tokens"></jolly-separator>
          <studio-agent-tokens .tokens=${this.tokens}></studio-agent-tokens>
        </section>
      `}
      ${this.links === null || this.catalog === null ? nothing : html`
        <section aria-label="Share links">
          <jolly-separator label="Share links">
            <jolly-button
              slot="actions"
              data-action="refresh"
              icon="loop"
              icon-only
              label="Refresh"
              title="Refresh"
              @click=${this.#refresh}
            ></jolly-button>
          </jolly-separator>
          <p>
            View-only links to one asset, for people without an account.
            Create one from the Share action of an asset.
          </p>
          <share-link-list
            show-asset
            .links=${this.links}
            .catalog=${this.catalog}
            .kinds=${this.kinds}
          ></share-link-list>
        </section>
      `}
    `;
  }

  readonly #refresh = (): void => {
    void this.links?.load();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-access-keys": AccessKeys;
  }
}
