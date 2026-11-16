// Import Third-party Dependencies
import {
  GUEST_ROLE,
  type Member,
  type ShareLink
} from "@jolly-pixel/accounts";
import type { AccountsRealm } from "@jolly-pixel/accounts/node";
import {
  AssetRoom,
  type AssetKind
} from "@jolly-pixel/asset";
import { CATALOG_VIEW_ROOM } from "@jolly-pixel/asset-server";
import type { PeerIdentity } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { ShareLifetime } from "../ShareLifetime.ts";
import type { Project } from "../../project/node/Project.ts";
import { UnknownAssetError } from "../../project/node/errors/UnknownAssetError.ts";

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

export interface ProjectSharesOptions {
  realm: AccountsRealm;
  project: Pick<Project, "access">;
  catalog: SharedCatalog;
}

export class ProjectShares {
  #realm: AccountsRealm;
  #project: Pick<Project, "access">;
  #catalog: SharedCatalog;

  constructor(
    options: ProjectSharesOptions
  ) {
    this.#realm = options.realm;
    this.#project = options.project;
    this.#catalog = options.catalog;
  }

  list(
    account: Member
  ): ShareLink[] {
    return this.#realm.shareLinks.visibleTo(account.id);
  }

  create(
    account: Member,
    assetId: string,
    lifetime: ShareLifetime
  ): ShareLink {
    this.#project.access.projectRights(account.role).require("share");
    if (this.#catalog.record(assetId) === undefined) {
      throw new UnknownAssetError(assetId);
    }

    return this.#realm.shareLinks.create({
      assetId,
      createdBy: account.id,
      expiresAt: lifetime.expiresAt(Date.now())
    });
  }

  revoke(
    account: Member,
    linkId: string
  ): void {
    this.#realm.shareLinks.revoke(account.id, linkId);
  }

  opened(
    token: string
  ): SharedAsset | null {
    const link = this.#realm.shareLinks.find(token);
    if (link === null) {
      return null;
    }

    const record = this.#catalog.record(link.assetId);

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

    return this.#realm.shareLinks.bySubject(identity.subject)?.assetId ??
      null;
  }

  admits(
    identity: PeerIdentity,
    room: string
  ): boolean {
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
      this.#catalog.reachableFrom(assetId).has(assetRoom.assetId.value);
  }
}
