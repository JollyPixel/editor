// Import Third-party Dependencies
import { ProjectFile } from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { Project } from "../../project/node/Project.ts";
import { DuplicateProjectError } from "./errors/DuplicateProjectError.ts";
import type { ProjectRegistry } from "./ProjectRegistry.ts";

export class ProjectIds {
  #registry: ProjectRegistry;
  #owners = new Map<string, string>();

  constructor(
    registry: ProjectRegistry
  ) {
    this.#registry = registry;
  }

  async claim(
    id: string,
    slug: string
  ): Promise<void> {
    const owner = this.#owners.get(id);
    if (owner !== undefined && owner !== slug && await this.#holds(owner, id)) {
      throw new DuplicateProjectError(slug, owner);
    }
    this.#owners.set(id, slug);
  }

  async #holds(
    slug: string,
    id: string
  ): Promise<boolean> {
    const root = await this.#registry.resolve(slug);

    return root !== null &&
      Project.findId(await ProjectFile.read(root)) === id;
  }
}
