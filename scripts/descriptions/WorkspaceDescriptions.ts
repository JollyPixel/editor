// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// CONSTANTS
const kScope = "@jolly-pixel/";

export interface DescribedWorkspace {
  directory: string;
  manifest: {
    name: string;
    description?: string;
  };
}

export class WorkspaceDescriptions {
  readonly #root: string;
  readonly #workspaces: DescribedWorkspace[];

  constructor(
    root: string,
    workspaces: Iterable<DescribedWorkspace>
  ) {
    this.#root = root;
    this.#workspaces = [...workspaces];
  }

  * problems(): IterableIterator<string> {
    const rootReadme = this.#read(path.join(this.#root, "README.md")) ?? "";

    for (const { directory, manifest } of this.#workspaces) {
      if (!manifest.description) {
        yield `${manifest.name}: package.json has no description`;
        continue;
      }
      const description = plain(manifest.description);

      const relative = path.relative(this.#root, directory).split(path.sep).join("/");
      const link = `- [${manifest.name.replace(kScope, "")}](./${relative}) - `;
      const line = rootReadme.split("\n").find((candidate) => candidate.startsWith(link));
      if (line === undefined) {
        yield `README.md: no "${link}..." line for ${manifest.name}`;
      }
      else if (plain(line.slice(link.length)) !== description) {
        yield `README.md: the ${manifest.name} line differs from its package.json description`;
      }

      const readme = this.#read(path.join(directory, "README.md"));
      if (readme !== null && plain(firstParagraph(readme)) !== description) {
        yield `${relative}/README.md: the first paragraph differs from the package.json description`;
      }
    }
  }

  #read(
    file: string
  ): string | null {
    return fs.existsSync(file) ?
      fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n") :
      null;
  }
}

function firstParagraph(
  markdown: string
): string {
  const blocks = markdown.split(/\n{2,}/).map((block) => block.trim());
  const paragraph = blocks.find(
    (block) => block !== "" && !block.startsWith("<") && !/^# [^\n]*$/.test(block)
  );

  return paragraph ?? "";
}

function plain(
  text: string
): string {
  return text.replaceAll("`", "").trim();
}
