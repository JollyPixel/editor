// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import { ProjectCreationError } from "./errors/ProjectCreationError.ts";
import type {
  ProjectEntry,
  ProjectRegistry
} from "./ProjectRegistry.ts";

export class SingleProject implements ProjectRegistry {
  readonly slug: string;

  #root: string;

  constructor(
    root: string
  ) {
    this.#root = path.resolve(root);
    this.slug = path.basename(this.#root);
  }

  resolve(
    slug: string
  ): Promise<string | null> {
    return Promise.resolve(slug === this.slug ? this.#root : null);
  }

  list(): Promise<ProjectEntry[]> {
    return Promise.resolve([
      {
        slug: this.slug,
        root: this.#root
      }
    ]);
  }

  create(): Promise<string> {
    return Promise.reject(
      new ProjectCreationError("this server keeps no projects folder")
    );
  }
}
