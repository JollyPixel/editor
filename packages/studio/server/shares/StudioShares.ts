// Import Third-party Dependencies
import {
  GUEST_ROLE,
  type Account,
  type ShareLink
} from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";
import {
  AssetRoom,
  type AssetKind
} from "@jolly-pixel/asset";
import { CATALOG_VIEW_ROOM } from "@jolly-pixel/asset-server";
import type { PeerIdentity } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { ShareLifetime } from "../../shared/ShareLifetime.ts";
import type { StudioProject } from "../project/StudioProject.ts";
import { UnknownAssetError } from "./errors/UnknownAssetError.ts";

export interface SharedCatalog {
  record(
    assetId: string
  ): { readonly kind: AssetKind; } | undefined;
  reachableFrom(
    assetId: string
  ): ReadonlySet<string>;
}

export interface SharedAsset {
  readonly assetId: string;
  readonly kind: string;
}

export interface StudioSharesOptions {
  accounts: Accounts;
  project: Pick<StudioProject, "access">;
  catalog: Promise<SharedCatalog>;
}

export class StudioShares {
  #accounts: Accounts;
  #project: Pick<StudioProject, "access">;
  #catalog: Promise<SharedCatalog>;

  constructor(
    options: StudioSharesOptions
  ) {
    this.#accounts = options.accounts;
    this.#project = options.project;
    this.#catalog = options.catalog;
  }

  list(
    account: Account
  ): ShareLink[] {
    return this.#accounts.shareLinks.visibleTo(account.id);
  }

  async create(
    account: Account,
    assetId: string,
    lifetime: ShareLifetime
  ): Promise<ShareLink> {
    this.#project.access.projectRights(account.role).require("share");
    if ((await this.#catalog).record(assetId) === undefined) {
      throw new UnknownAssetError(assetId);
    }

    return this.#accounts.shareLinks.create({
      assetId,
      createdBy: account.id,
      expiresAt: lifetime.expiresAt(Date.now())
    });
  }

  revoke(
    account: Account,
    linkId: string
  ): void {
    this.#accounts.shareLinks.revoke(account.id, linkId);
  }

  async opened(
    token: string
  ): Promise<SharedAsset | null> {
    const link = this.#accounts.shareLinks.find(token);
    if (link === null) {
      return null;
    }

    const record = (await this.#catalog).record(link.assetId);

    return record === undefined ?
      null :
      {
        assetId: link.assetId,
        kind: record.kind.value
      };
  }

  scope(
    identity: PeerIdentity
  ): string | null {
    if (identity.role !== GUEST_ROLE) {
      return null;
    }

    return this.#accounts.shareLinks.bySubject(identity.subject)?.assetId ??
      null;
  }

  async admits(
    identity: PeerIdentity,
    room: string
  ): Promise<boolean> {
    if (identity.role !== GUEST_ROLE) {
      return true;
    }

    const assetId = this.scope(identity);
    if (assetId === null) {
      return false;
    }
    if (room === CATALOG_VIEW_ROOM) {
      return true;
    }

    const assetRoom = AssetRoom.parse(room);

    return assetRoom !== null &&
      (await this.#catalog).reachableFrom(assetId).has(assetRoom.assetId.value);
  }
}
