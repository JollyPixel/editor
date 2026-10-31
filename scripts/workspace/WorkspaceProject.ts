// Import Node.js Dependencies
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Import Internal Dependencies
import { ROOT_DIR } from "./root.ts";

export interface PackageManifest {
  name: string;
  private?: boolean;
  main?: string;
  types?: string;
  exports?: Record<string, unknown>;
  scripts?: Record<string, string>;
}

interface ListedProject {
  path: string;
}

export class WorkspaceProject {
  static all(): WorkspaceProject[] {
    return WorkspaceProject.#list("-r");
  }

  static selected(
    selectors: readonly string[],
    testPatterns: readonly string[] = []
  ): WorkspaceProject[] {
    return WorkspaceProject.#list([
      ...selectors.map((selector) => `--filter "${selector}"`),
      ...testPatterns.map((pattern) => `--test-pattern "${pattern}"`)
    ].join(" "));
  }

  static read(
    directory: string
  ): WorkspaceProject {
    const manifest: PackageManifest = JSON.parse(
      fs.readFileSync(path.join(directory, "package.json"), "utf8")
    );

    return new WorkspaceProject(directory, manifest);
  }

  static #list(
    selection: string
  ): WorkspaceProject[] {
    const output = execSync(`pnpm ${selection} ls --depth -1 --json`, {
      cwd: ROOT_DIR,
      encoding: "utf8"
    });
    const listed: ListedProject[] = JSON.parse(output);

    return listed
      .map((project) => path.resolve(project.path))
      .filter((directory) => directory !== path.resolve(ROOT_DIR))
      .map((directory) => WorkspaceProject.read(directory))
      .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
  }

  readonly directory: string;
  readonly manifest: PackageManifest;

  constructor(
    directory: string,
    manifest: PackageManifest
  ) {
    this.directory = directory;
    this.manifest = manifest;
  }
}
