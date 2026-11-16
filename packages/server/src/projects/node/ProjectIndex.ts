// Import Third-party Dependencies
import {
  ADMIN_ROLE,
  type Account
} from "@jolly-pixel/accounts";
import type { AccountMembership } from "@jolly-pixel/accounts/node";
import { ProjectFile } from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { ProjectRightRefusedError } from "../../project/errors/ProjectRightRefusedError.ts";
import { Project } from "../../project/node/Project.ts";
import type { ProjectSummary } from "../api.ts";
import type {
  ProjectEntry,
  ProjectRegistry
} from "./ProjectRegistry.ts";

export interface ProjectIndexOptions {
  registry: ProjectRegistry;
  memberships(accountId: string): AccountMembership[];
  /**
   * Opens the project at a new root, writing its project file.
   */
  open: (root: string) => Promise<Project>;
}

interface ReadEntry {
  slug: string;
  id: string | null;
  unavailable: string | null;
}

export class ProjectIndex {
  #registry: ProjectRegistry;
  #memberships: (accountId: string) => AccountMembership[];
  #open: (root: string) => Promise<Project>;

  constructor(
    options: ProjectIndexOptions
  ) {
    this.#registry = options.registry;
    this.#memberships = options.memberships;
    this.#open = options.open;
  }

  async list(
    account: Account
  ): Promise<ProjectSummary[]> {
    const entries = await Promise.all(
      (await this.#registry.list()).map(readEntry)
    );
    if (account.owner) {
      return entries.map((entry) => {
        return {
          slug: entry.slug,
          role: ADMIN_ROLE,
          pending: false,
          unavailable: entry.unavailable
        };
      });
    }
    const memberships = new Map(
      this.#memberships(account.id).map(
        (membership) => [membership.realmId, membership]
      )
    );

    return entries.flatMap((entry) => {
      const membership = entry.id === null ?
        undefined :
        memberships.get(entry.id);

      return membership === undefined ?
        [] :
        [{
          slug: entry.slug,
          role: membership.pending ? null : membership.role,
          pending: membership.pending,
          unavailable: null
        }];
    });
  }

  async create(
    account: Account,
    slug: string
  ): Promise<ProjectSummary> {
    if (!account.owner) {
      throw new ProjectRightRefusedError("only the server owner creates projects");
    }
    await this.#open(await this.#registry.create(slug));

    return {
      slug,
      role: ADMIN_ROLE,
      pending: false,
      unavailable: null
    };
  }
}

async function readEntry(
  entry: ProjectEntry
): Promise<ReadEntry> {
  try {
    return {
      slug: entry.slug,
      id: Project.findId(await ProjectFile.read(entry.root)),
      unavailable: null
    };
  }
  catch (error) {
    return {
      slug: entry.slug,
      id: null,
      unavailable: error instanceof Error ? error.message : String(error)
    };
  }
}
