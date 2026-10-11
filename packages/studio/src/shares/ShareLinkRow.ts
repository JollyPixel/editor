// Import Third-party Dependencies
import type { ShareLink } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { VIEW_PAGES_PATH } from "./routes.ts";

// CONSTANTS
const kDate = new Intl.DateTimeFormat("en", {
  dateStyle: "medium"
});
const kMissingAsset = "Deleted asset";
const kUnknownCreator = "a removed account";

export interface ShareLinkLookups {
  /**
   * Catalog path of an asset, `undefined` once it is gone.
   */
  assetPath(
    assetId: string
  ): string | undefined;
  /**
   * Username of an account, `undefined` when the roster does not list it.
   */
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
  readonly url: string;
  readonly creator: string;
  readonly created: string;
  readonly expires: string;

  constructor(
    link: ShareLink,
    lookups: ShareLinkLookups
  ) {
    this.id = link.id;
    this.asset = lookups.assetPath(link.assetId) ?? kMissingAsset;
    this.url = new URL(`${VIEW_PAGES_PATH}${link.token}`, lookups.baseUrl).href;
    this.creator = lookups.username(link.createdBy) ?? kUnknownCreator;
    this.created = kDate.format(link.createdAt);
    this.expires = link.expiresAt === null ?
      "Never expires" :
      `Expires ${kDate.format(link.expiresAt)}`;
  }
}
