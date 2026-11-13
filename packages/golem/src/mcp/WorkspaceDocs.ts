// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// CONSTANTS
const kWorkspaceFolders = [
  "",
  "assets",
  "editors"
];
const kScope = "@jolly-pixel/";

export interface WorkspaceDoc {
  workspace: string;
  file: string;
}

export class WorkspaceDocs {
  #root: string;
  #docsDirs: Map<string, string> | null = null;

  constructor(
    root: string
  ) {
    this.#root = root;
  }

  * list(): IterableIterator<WorkspaceDoc> {
    for (const [workspace, docsDir] of this.#index()) {
      for (const file of fs.readdirSync(docsDir)) {
        if (path.extname(file) === ".md") {
          yield {
            workspace,
            file
          };
        }
      }
    }
  }

  read(
    doc: WorkspaceDoc
  ): string | null {
    const docsDir = this.#index().get(doc.workspace);
    if (docsDir === undefined) {
      return null;
    }

    const docFile = path.resolve(docsDir, doc.file);
    if (
      !isInside(docsDir, docFile) ||
      path.extname(docFile) !== ".md" ||
      !fs.existsSync(docFile)
    ) {
      return null;
    }

    return fs.readFileSync(docFile, "utf-8");
  }

  #index(): Map<string, string> {
    this.#docsDirs ??= new Map(this.#scan());

    return this.#docsDirs;
  }

  * #scan(): IterableIterator<[string, string]> {
    for (const folder of kWorkspaceFolders) {
      const parent = path.join(this.#root, folder);
      for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
        const dir = path.join(parent, entry.name);
        const docsDir = path.join(dir, "docs");
        const manifest = path.join(dir, "package.json");
        if (
          !entry.isDirectory() ||
          !fs.existsSync(docsDir) ||
          !fs.existsSync(manifest)
        ) {
          continue;
        }

        const { name } = JSON.parse(fs.readFileSync(manifest, "utf-8"));
        if (typeof name === "string" && name.startsWith(kScope)) {
          yield [name.slice(kScope.length), docsDir];
        }
      }
    }
  }
}

function isInside(
  dir: string,
  file: string
): boolean {
  const relative = path.relative(dir, file);

  return relative !== "" &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative);
}
