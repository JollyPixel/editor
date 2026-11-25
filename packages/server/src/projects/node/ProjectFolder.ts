// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { PROJECT_FILE_PATH } from "@jolly-pixel/asset-server";
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { PROJECT_SLUG_PATTERN } from "../api.ts";
import { ProjectFolderError } from "./errors/ProjectFolderError.ts";
import { UnknownProjectError } from "./errors/UnknownProjectError.ts";
import type {
  ProjectEntry,
  ProjectRegistry
} from "./ProjectRegistry.ts";

// CONSTANTS
const kTrashFolder = "trash";

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
    if (
      !PROJECT_SLUG_PATTERN.test(slug) ||
      !(await fs.readdir(this.#directory)).includes(slug)
    ) {
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
    const root = this.#namedRoot(slug);
    try {
      await fs.mkdir(root);
    }
    catch (error) {
      throw folderTaken(slug, error);
    }

    return root;
  }

  async rename(
    slug: string,
    to: string
  ): Promise<string> {
    const root = await this.#existing(slug);
    const target = this.#namedRoot(to);
    if (await pathExists(target)) {
      throw folderTaken(to);
    }
    await fs.rename(root, target);

    return target;
  }

  async remove(
    slug: string
  ): Promise<void> {
    const root = await this.#existing(slug);
    const trash = path.join(this.#directory, STATE_DIRECTORY, kTrashFolder);
    await fs.mkdir(trash, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
    await fs.rename(root, path.join(trash, `${slug}-${stamp}`));
  }

  async #existing(
    slug: string
  ): Promise<string> {
    const root = await this.resolve(slug);
    if (root === null) {
      throw new UnknownProjectError(slug);
    }

    return root;
  }

  #namedRoot(
    slug: string
  ): string {
    if (!PROJECT_SLUG_PATTERN.test(slug)) {
      throw new ProjectFolderError(`"${slug}" cannot name a project`);
    }

    return this.#root(slug);
  }

  #root(
    slug: string
  ): string {
    return path.join(this.#directory, slug);
  }
}

function folderTaken(
  slug: string,
  cause?: unknown
): ProjectFolderError {
  return new ProjectFolderError(`a folder is already named "${slug}"`, cause);
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

async function pathExists(
  target: string
): Promise<boolean> {
  try {
    await fs.lstat(target);

    return true;
  }
  catch {
    return false;
  }
}
