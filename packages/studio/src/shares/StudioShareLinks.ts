// Import Third-party Dependencies
import type {
  AccountsRoster,
  ShareLink
} from "@jolly-pixel/accounts";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { ShareLinkRow } from "./ShareLinkRow.ts";
import type { ShareLinksClient } from "./ShareLinksClient.ts";
import type { ShareLifetimeName } from "./ShareLifetime.ts";

// CONSTANTS
export const SHARE_LINKS_CHANGE = "change";

export class StudioShareLinks extends EventTarget {
  readonly roster: AccountsRoster;

  #client: ShareLinksClient;
  #links: readonly ShareLink[] = [];
  #canShare = false;
  #error: string | null = null;

  constructor(
    client: ShareLinksClient,
    roster: AccountsRoster
  ) {
    super();
    this.#client = client;
    this.roster = roster;
  }

  get canShare(): boolean {
    return this.#canShare;
  }

  get error(): string | null {
    return this.#error;
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
    await this.#run(async() => {
      const { links, canShare } = await this.#client.list();
      this.#links = links;
      this.#canShare = canShare;
    });
  }

  create(
    assetId: string,
    lifetime: ShareLifetimeName
  ): Promise<ShareLink | null> {
    return this.#run(async() => {
      const { link } = await this.#client.create(assetId, lifetime);
      this.#links = [...this.#links, link];

      return link;
    });
  }

  async revoke(
    linkId: string
  ): Promise<void> {
    await this.#run(async() => {
      await this.#client.revoke(linkId);
      this.#links = this.#links.filter((link) => link.id !== linkId);
    });
  }

  async #run<TResult>(
    action: () => Promise<TResult>
  ): Promise<TResult | null> {
    try {
      const result = await action();
      this.#error = null;

      return result;
    }
    catch (error) {
      this.#error = error instanceof Error ? error.message : String(error);

      return null;
    }
    finally {
      this.dispatchEvent(new Event(SHARE_LINKS_CHANGE));
    }
  }
}
