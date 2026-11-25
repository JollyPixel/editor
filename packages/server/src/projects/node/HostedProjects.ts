// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type {
  AssetArchive,
  AssetSeedMap
} from "@jolly-pixel/asset-server";
import { ProjectFile } from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { Project } from "../../project/node/Project.ts";
import type { ProjectArchive } from "../../project/node/ProjectArchive.ts";
import type { ShellPackages } from "../../project/node/ShellPackages.ts";
import { ProjectUnavailableError } from "./errors/ProjectUnavailableError.ts";
import { UnknownProjectError } from "./errors/UnknownProjectError.ts";
import {
  OpenProjects,
  type ProjectLease
} from "./OpenProjects.ts";
import { ProjectIds } from "./ProjectIds.ts";
import type {
  ProjectEntry,
  ProjectRegistry
} from "./ProjectRegistry.ts";

export interface HostedBackend extends AsyncDisposable {
  readonly archive: ProjectArchive;
}

export interface HostedProjectsOptions<TBackend extends HostedBackend> {
  registry: ProjectRegistry;
  /**
   * Opens the project found at a root of the registry.
   */
  openProject: (root: string) => Promise<Project>;
  /**
   * Starts the back-end of an opened project, seeding an empty one with
   * `seed`.
   */
  start: (
    project: Project,
    seed: AssetSeedMap | undefined
  ) => Promise<TBackend>;
  seed?: AssetSeedMap;
  /**
   * Packages a project may list. A project listing another does not open.
   * @default every package
   */
  shellPackages?: ShellPackages;
  /**
   * @default DEFAULT_PROJECT_IDLE_MS
   */
  idleMs?: number | null;
}

export interface ProjectStatus {
  slug: string;
  id: string | null;
  unavailable: string | null;
}

export class HostedProjects<TBackend extends HostedBackend>
implements AsyncDisposable {
  #registry: ProjectRegistry;
  #openProject: (root: string) => Promise<Project>;
  #start: HostedProjectsOptions<TBackend>["start"];
  #seed: AssetSeedMap | undefined;
  #shellPackages: ShellPackages | undefined;
  #ids: ProjectIds;
  #opened: OpenProjects<TBackend>;
  #unseeded = new Set<string>();

  constructor(
    options: HostedProjectsOptions<TBackend>
  ) {
    this.#registry = options.registry;
    this.#openProject = options.openProject;
    this.#start = options.start;
    this.#seed = options.seed;
    this.#shellPackages = options.shellPackages;
    this.#ids = new ProjectIds(options.registry);
    this.#opened = new OpenProjects({
      idleMs: options.idleMs,
      open: (slug) => this.#launch(slug)
    });
  }

  acquire(
    slug: string
  ): Promise<ProjectLease<TBackend>> {
    return this.#opened.acquire(slug);
  }

  async statuses(): Promise<ProjectStatus[]> {
    const checked = await Promise.all(
      (await this.#registry.list()).map((entry) => this.#check(entry))
    );
    const statuses: ProjectStatus[] = [];
    for (const status of checked) {
      statuses.push(await this.#claim(status));
    }

    return statuses;
  }

  async create(
    slug: string
  ): Promise<void> {
    await this.#openProject(await this.#registry.create(slug));
  }

  async import(
    slug: string,
    account: Account,
    archive: AssetArchive
  ): Promise<void> {
    this.#unseeded.add(slug);
    try {
      await this.create(slug);
      await this.#restore(slug, account, archive);
    }
    finally {
      this.#unseeded.delete(slug);
    }
  }

  async rename(
    slug: string,
    to: string
  ): Promise<void> {
    await this.#opened.retire(slug, () => this.#registry.rename(slug, to));
  }

  async remove(
    slug: string
  ): Promise<void> {
    await this.#opened.retire(slug, () => this.#registry.remove(slug));
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.#opened[Symbol.asyncDispose]();
  }

  async #launch(
    slug: string
  ): Promise<TBackend> {
    const root = await this.#registry.resolve(slug);
    if (root === null) {
      throw new UnknownProjectError(slug);
    }
    try {
      const project = await this.#openFitting(root);
      await this.#ids.claim(project.id, slug);

      return await this.#start(
        project,
        this.#unseeded.has(slug) ? undefined : this.#seed
      );
    }
    catch (error) {
      throw new ProjectUnavailableError(slug, error);
    }
  }

  async #openFitting(
    root: string
  ): Promise<Project> {
    const project = await this.#openProject(root);
    this.#shellPackages?.require(project);

    return project;
  }

  async #restore(
    slug: string,
    account: Account,
    archive: AssetArchive
  ): Promise<void> {
    try {
      using lease = await this.#opened.acquire(slug);
      await lease.project.archive.restore(account, archive);
    }
    catch (error) {
      await this.remove(slug);

      throw error;
    }
  }

  async #check(
    entry: ProjectEntry
  ): Promise<ProjectStatus> {
    let id: string | null = null;
    try {
      id = Project.findId(await ProjectFile.read(entry.root));
      if (id !== null) {
        await this.#openFitting(entry.root);
      }

      return {
        slug: entry.slug,
        id,
        unavailable: null
      };
    }
    catch (error) {
      return {
        slug: entry.slug,
        id,
        unavailable: reason(error)
      };
    }
  }

  async #claim(
    status: ProjectStatus
  ): Promise<ProjectStatus> {
    if (status.id === null || status.unavailable !== null) {
      return status;
    }
    try {
      await this.#ids.claim(status.id, status.slug);

      return status;
    }
    catch (error) {
      return {
        ...status,
        unavailable: reason(error)
      };
    }
  }
}

function reason(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}
