// Import Third-party Dependencies
import {
  ADMIN_ROLE,
  type Account
} from "@jolly-pixel/accounts";
import type { AccountMembership } from "@jolly-pixel/accounts/node";
import { readAssetArchive } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type { ProjectSummary } from "../api.ts";
import type {
  HostedBackend,
  HostedProjects
} from "./HostedProjects.ts";
import { requireServerOwner } from "./requireServerOwner.ts";

export interface ProjectIndexOptions {
  projects: HostedProjects<HostedBackend>;
  memberships(accountId: string): AccountMembership[];
}

export class ProjectIndex {
  #projects: HostedProjects<HostedBackend>;
  #memberships: (accountId: string) => AccountMembership[];

  constructor(
    options: ProjectIndexOptions
  ) {
    this.#projects = options.projects;
    this.#memberships = options.memberships;
  }

  async list(
    account: Account
  ): Promise<ProjectSummary[]> {
    const statuses = await this.#projects.statuses();
    if (account.owner) {
      return statuses.map((status) => ownedSummary(
        status.slug,
        status.unavailable
      ));
    }
    const memberships = new Map(
      this.#memberships(account.id).map(
        (membership) => [membership.realmId, membership]
      )
    );

    return statuses.flatMap((status) => {
      const membership = status.id === null ?
        undefined :
        memberships.get(status.id);

      return membership === undefined ?
        [] :
        [{
          slug: status.slug,
          role: membership.pending ? null : membership.role,
          pending: membership.pending,
          unavailable: status.unavailable
        }];
    });
  }

  async create(
    account: Account,
    slug: string
  ): Promise<ProjectSummary> {
    requireServerOwner(account, "creates");
    await this.#projects.create(slug);

    return ownedSummary(slug);
  }

  async import(
    account: Account,
    slug: string,
    bytes: Uint8Array
  ): Promise<ProjectSummary> {
    requireServerOwner(account, "imports");
    const archive = readAssetArchive(bytes);
    if (!archive.ok) {
      throw archive.val;
    }
    await this.#projects.import(slug, account, archive.val);

    return ownedSummary(slug);
  }

  async rename(
    account: Account,
    slug: string,
    to: string
  ): Promise<ProjectSummary> {
    requireServerOwner(account, "renames");
    await this.#projects.rename(slug, to);

    return ownedSummary(to);
  }

  async remove(
    account: Account,
    slug: string
  ): Promise<void> {
    requireServerOwner(account, "deletes");
    await this.#projects.remove(slug);
  }
}

function ownedSummary(
  slug: string,
  unavailable: string | null = null
): ProjectSummary {
  return {
    slug,
    role: ADMIN_ROLE,
    pending: false,
    unavailable
  };
}
