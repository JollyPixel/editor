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
  query,
  state
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  SubscriptionController,
  type Dialog,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetLeafData } from "../../catalog/AssetTreeModel.ts";
import {
  ShareLifetime,
  type ShareLifetimeName
} from "../../shares/ShareLifetime.ts";
import {
  SHARE_LINKS_CHANGE,
  type StudioShareLinks
} from "../../shares/StudioShareLinks.ts";
import type { ShareLinkList } from "../shares/ShareLinkList.ts";
import "../shares/ShareLinkList.ts";

// CONSTANTS
const kDefaultLifetime: ShareLifetimeName = "7d";
const kLifetimeOptions: JollyOption<ShareLifetimeName>[] = ShareLifetime.all()
  .map((lifetime) => {
    return {
      value: lifetime.name,
      label: lifetime.label
    };
  });

interface ShareTarget {
  asset: AssetLeafData;
  catalog: CatalogClient;
}

@customElement("asset-share-dialog")
export class AssetShareDialog extends LitElement {
  static override styles = css`
    p {
      margin: 0 0 var(--jolly-space-2, 8px);
    }

    .create {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2, 8px);
      margin-block-end: var(--jolly-space-2, 8px);
    }

    .muted {
      color: var(--jolly-text-muted);
    }
  `;

  @state()
  declare _target: ShareTarget | null;

  @state()
  declare _lifetime: ShareLifetimeName;

  @state()
  declare _status: string | null;

  @query("jolly-dialog")
  declare _dialog: Dialog;

  @query("share-link-list")
  declare _list: ShareLinkList;

  #links = new SubscriptionController<StudioShareLinks>(this, (links) => {
    const repaint = () => this.requestUpdate();
    links.addEventListener(SHARE_LINKS_CHANGE, repaint);

    return [
      () => links.removeEventListener(SHARE_LINKS_CHANGE, repaint)
    ];
  });

  constructor() {
    super();
    this._target = null;
    this._lifetime = kDefaultLifetime;
    this._status = null;
  }

  async open(
    asset: AssetLeafData,
    links: StudioShareLinks,
    catalog: CatalogClient
  ): Promise<void> {
    this.#links.attach(links);
    this._target = {
      asset,
      catalog
    };
    this._lifetime = kDefaultLifetime;
    this._status = null;

    await this.updateComplete;
    await this._dialog.showModal();
    await links.load();
  }

  override render(): TemplateResult {
    const target = this._target;
    const links = this.#links.current;

    return html`
      <jolly-dialog
        heading=${target === null ? "" : `Share "${target.asset.path.name}"`}
        icon="share"
      >
        <p>
          Anyone with a link can view this asset and the assets it uses,
          without an account. Nobody can edit through a link.
        </p>
        ${links?.canShare ? html`
          <div class="create">
            <jolly-button-group
              aria-label="Link lifetime"
              .options=${kLifetimeOptions}
              .value=${this._lifetime}
              @jolly-change=${this.#onLifetimeChange}
            ></jolly-button-group>
            <jolly-button
              variant="accent"
              data-action="create"
              @click=${this.#create}
            >Create link</jolly-button>
          </div>
        ` : html`
          <p class="muted">Your role cannot create share links.</p>
        `}
        ${this._status === null ? nothing : html`
          <p role="status">${this._status}</p>
        `}
        ${target === null || links === null ? nothing : html`
          <share-link-list
            .links=${links}
            .catalog=${target.catalog}
            .assetId=${target.asset.id}
          ></share-link-list>
        `}
        <jolly-button
          slot="actions"
          data-action="close"
          @click=${this.#close}
        >Close</jolly-button>
      </jolly-dialog>
    `;
  }

  #onLifetimeChange(
    event: CustomEvent<JollyChangeDetail<ShareLifetimeName>>
  ): void {
    this._lifetime = event.detail.value;
  }

  async #create(): Promise<void> {
    const target = this._target;
    const links = this.#links.current;
    if (target === null || links === null) {
      return;
    }

    this._status = null;
    const link = await links.create(target.asset.id, this._lifetime);
    if (link === null) {
      return;
    }

    await this.updateComplete;
    this._status = await this._list.copy(link.id) ?
      "Link created and copied to the clipboard." :
      "Link created.";
  }

  #close(): void {
    this._dialog.close("close");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "asset-share-dialog": AssetShareDialog;
  }
}
