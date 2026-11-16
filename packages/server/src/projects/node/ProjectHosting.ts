// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  PrefixMount,
  RootMount,
  type ProjectMount
} from "./ProjectMount.ts";
import { ProjectFolder } from "./ProjectFolder.ts";
import type { ProjectRegistry } from "./ProjectRegistry.ts";
import { SingleProject } from "./SingleProject.ts";

export interface ProjectHostingParts {
  registry: ProjectRegistry;
  mount: ProjectMount;
  /**
   * Folder of the server's own state, such as its accounts.
   */
  state: string;
}

export class ProjectHosting {
  static single(
    root: string
  ): ProjectHosting {
    const project = new SingleProject(root);

    return new ProjectHosting({
      registry: project,
      mount: new RootMount(project.slug),
      state: path.join(path.resolve(root), STATE_DIRECTORY)
    });
  }

  static folder(
    directory: string
  ): ProjectHosting {
    const resolved = path.resolve(directory);

    return new ProjectHosting({
      registry: new ProjectFolder(resolved),
      mount: new PrefixMount(),
      state: path.join(resolved, STATE_DIRECTORY)
    });
  }

  readonly registry: ProjectRegistry;
  readonly mount: ProjectMount;
  readonly state: string;

  constructor(
    parts: ProjectHostingParts
  ) {
    this.registry = parts.registry;
    this.mount = parts.mount;
    this.state = parts.state;
  }
}
