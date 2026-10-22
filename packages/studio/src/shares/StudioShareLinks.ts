// Import Third-party Dependencies
import type {
  AccountsRoster,
  ShareLink
} from "@jolly-pixel/accounts";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { RemoteState } from "../api/RemoteState.ts";
import { ShareLinkRow } from "./ShareLinkRow.ts";
import type { ShareLinksClient } from "./ShareLinksClient.ts";
import type { ShareLifetimeName } from "../../shared/ShareLifetime.ts";

export type ShareLinksSource = Pick<ShareLinksClient, "list" | "create" | "revoke">;

export class StudioShareLinks extends RemoteState {
  readonly roster: AccountsRoster;
  readonly canShare: boolean;

  #client: ShareLinksSource;
  #links: readonly ShareLink[] = [];

  constructor(
    client: ShareLinksSource,
    roster: AccountsRoster,
    canShare: boolean
  ) {
    super();
    this.#client = client;
    this.roster = roster;
    this.canShare = canShare;
  }

  rows(
    catalog: Pick<CatalogClient, "record">,
    assetId?: string
  ): ShareLinkRow[] {
    const links = assetId === undefined ?
      this.#links :
      this.#links.filter((link) => link.assetId === assetId);

    return ShareLinkRow.newestFirst(links, {
      assetPath: (id) => catalog.record(id)?.path,
      username: (accountId) => [...this.roster].find(
        (entry) => entry.id === accountId
      )?.username,
      baseUrl: document.baseURI
    });
  }

  async load(): Promise<void> {
    await this.latest(() => this.#client.list(), ({ links }) => {
      this.#links = links;
    });
  }

  async create(
    assetId: string,
    lifetime: ShareLifetimeName
  ): Promise<ShareLink | null> {
    const created = await this.run(
      () => this.#client.create(assetId, lifetime),
      ({ link }) => {
        this.#links = [...this.#links, link];
      }
    );

    return created?.link ?? null;
  }

  async revoke(
    linkId: string
  ): Promise<void> {
    await this.run(() => this.#client.revoke(linkId), () => {
      this.#links = this.#links.filter((link) => link.id !== linkId);
    });
  }
}
