// Import Third-party Dependencies
import type { ShareLink } from "@jolly-pixel/accounts";
import { VIEW_PAGES_PATH } from "@jolly-pixel/server";

// CONSTANTS
const kDate = new Intl.DateTimeFormat("en", {
  dateStyle: "medium"
});
const kMissingAsset = "Deleted asset";
const kUnknownCreator = "a removed account";

export interface SharedAsset {
  path: string;
  kind: string;
}

export interface ShareLinkLookups {
  asset(
    assetId: string
  ): SharedAsset | undefined;
  username(
    accountId: string
  ): string | undefined;
  /**
   * Page the view URL resolves against.
   */
  readonly baseUrl: string;
}

export class ShareLinkRow {
  static newestFirst(
    links: Iterable<ShareLink>,
    lookups: ShareLinkLookups
  ): ShareLinkRow[] {
    return [...links]
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((link) => new ShareLinkRow(link, lookups));
  }

  readonly id: string;
  readonly asset: string;
  readonly kind: string | null;
  readonly url: string;
  readonly creator: string;
  readonly created: string;
  readonly expires: string;

  constructor(
    link: ShareLink,
    lookups: ShareLinkLookups
  ) {
    this.id = link.id;
    const asset = lookups.asset(link.assetId);
    this.asset = asset?.path ?? kMissingAsset;
    this.kind = asset?.kind ?? null;
    this.url = new URL(`${VIEW_PAGES_PATH}${link.token}`, lookups.baseUrl).href;
    this.creator = lookups.username(link.createdBy) ?? kUnknownCreator;
    this.created = kDate.format(link.createdAt);
    this.expires = link.expiresAt === null ?
      "Never expires" :
      `Expires ${kDate.format(link.expiresAt)}`;
  }
}
