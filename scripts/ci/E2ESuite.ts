// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import { ROOT_DIR } from "../workspace/root.ts";
import type { WorkspaceProject } from "../workspace/WorkspaceProject.ts";

export class E2ESuite {
  static read(
    project: WorkspaceProject
  ): E2ESuite | null {
    if (project.manifest.scripts?.["test:e2e"] === undefined) {
      return null;
    }

    const directory = path.relative(ROOT_DIR, project.directory)
      .split(path.sep)
      .join("/");

    return new E2ESuite(
      path.posix.basename(directory),
      project.manifest.name,
      `${directory}/test-results`
    );
  }

  readonly name: string;
  readonly filter: string;
  readonly artifactPath: string;

  constructor(
    name: string,
    filter: string,
    artifactPath: string
  ) {
    this.name = name;
    this.filter = filter;
    this.artifactPath = artifactPath;
  }
}
