// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { PROJECT_FILE_PATH } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { PROJECT_SLUG_PATTERN } from "../api.ts";
import { ProjectCreationError } from "./errors/ProjectCreationError.ts";
import type {
  ProjectEntry,
  ProjectRegistry
} from "./ProjectRegistry.ts";

export class ProjectFolder implements ProjectRegistry {
  #directory: string;

  constructor(
    directory: string
  ) {
    this.#directory = path.resolve(directory);
  }

  async resolve(
    slug: string
  ): Promise<string | null> {
    if (!PROJECT_SLUG_PATTERN.test(slug)) {
      return null;
    }
    const root = this.#root(slug);

    return await holdsProject(root) ? root : null;
  }

  async list(): Promise<ProjectEntry[]> {
    const children = await fs.readdir(this.#directory, {
      withFileTypes: true
    });
    const entries = children
      .filter((child) => child.isDirectory() &&
        PROJECT_SLUG_PATTERN.test(child.name))
      .map((child) => {
        return {
          slug: child.name,
          root: this.#root(child.name)
        };
      });
    const held = await Promise.all(
      entries.map((entry) => holdsProject(entry.root))
    );

    return entries
      .filter((_entry, index) => held[index])
      .sort((left, right) => left.slug.localeCompare(right.slug));
  }

  async create(
    slug: string
  ): Promise<string> {
    if (!PROJECT_SLUG_PATTERN.test(slug)) {
      throw new ProjectCreationError(`"${slug}" cannot name a project`);
    }
    const root = this.#root(slug);
    try {
      await fs.mkdir(root);
    }
    catch (error) {
      throw new ProjectCreationError(
        `a folder is already named "${slug}"`,
        error
      );
    }

    return root;
  }

  #root(
    slug: string
  ): string {
    return path.join(this.#directory, slug);
  }
}

async function holdsProject(
  root: string
): Promise<boolean> {
  try {
    const stats = await fs.stat(path.join(root, PROJECT_FILE_PATH));

    return stats.isFile();
  }
  catch {
    return false;
  }
}
