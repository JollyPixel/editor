// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import {
  PROJECT_MANIFEST_FILE,
  ProjectManifest
} from "../ProjectManifest.ts";
import type { Project } from "./Project.ts";

export interface ShellPackagesData {
  editors: Iterable<string>;
  kinds: Iterable<string>;
}

export class ShellPackages {
  static compiledFrom(
    project: Pick<Project, "editors" | "kinds">
  ): ShellPackages {
    return new ShellPackages({
      editors: Array.from(project.editors, (editor) => editor.package),
      kinds: project.kinds.packages.map((kindPackage) => kindPackage.name)
    });
  }

  static async read(
    shell: string
  ): Promise<ShellPackages> {
    const file = path.join(shell, PROJECT_MANIFEST_FILE);
    let text: string;
    try {
      text = await fs.readFile(file, "utf8");
    }
    catch (error) {
      throw new Error(
        `"${file}" is missing: build the studio before serving it.`,
        { cause: error }
      );
    }
    const manifest = ProjectManifest.parse(JSON.parse(text));

    return new ShellPackages({
      editors: manifest.editors.map((editor) => editor.package),
      kinds: manifest.kindPackages.map((kindPackage) => kindPackage.name)
    });
  }

  #editors: ReadonlySet<string>;
  #kinds: ReadonlySet<string>;

  constructor(
    data: ShellPackagesData
  ) {
    this.#editors = new Set(data.editors);
    this.#kinds = new Set(data.kinds);
  }

  require(
    project: Pick<Project, "editors" | "kinds">
  ): void {
    const editors = Array.from(project.editors)
      .filter((editor) => !this.#editors.has(editor.package))
      .map((editor) => editor.name);
    const kinds = project.kinds.packages
      .map((kindPackage) => kindPackage.name)
      .filter((name) => !this.#kinds.has(name));
    const missing = [
      ...editors.length > 0 ? [`the editors ${editors.join(", ")}`] : [],
      ...kinds.length > 0 ? [`the kinds ${kinds.join(", ")}`] : []
    ];
    if (missing.length > 0) {
      throw new Error(`the studio build lacks ${missing.join(" and ")}`);
    }
  }
}
