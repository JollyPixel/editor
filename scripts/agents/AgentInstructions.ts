// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// CONSTANTS
const kSkillDirectories = [".agents/skills", ".claude/skills"];
const kRoutingBullet = /\n- These workspaces have an `AGENTS\.md`[\s\S]*?(?=\r?\n(?:-|#|\r?\n)|(?![\s\S]))/;
const kWorkspacePath = /`(packages\/[^`]+)`/g;

export class AgentInstructions {
  readonly #root: string;
  readonly #workspaces: string[];

  constructor(
    root: string,
    workspaces: Iterable<string>
  ) {
    this.#root = root;
    this.#workspaces = Array.from(
      workspaces,
      (directory) => path.relative(root, directory).split(path.sep).join("/")
    );
  }

  * problems(): IterableIterator<string> {
    yield* this.#skillCopyProblems();
    yield* this.#routingProblems();
  }

  * #skillCopyProblems(): IterableIterator<string> {
    const [canonical, copy] = kSkillDirectories.map(
      (directory) => path.join(this.#root, directory)
    );
    const files = new Set([
      ...this.#filesUnder(canonical),
      ...this.#filesUnder(copy)
    ]);

    for (const file of [...files].sort()) {
      const left = this.#read(path.join(canonical, file));
      const right = this.#read(path.join(copy, file));
      if (left === null || right === null) {
        yield `skills: "${file}" exists in only one of ${kSkillDirectories.join(" and ")}`;
      }
      else if (!left.equals(right)) {
        yield `skills: "${file}" differs between ${kSkillDirectories.join(" and ")}`;
      }
    }
  }

  * #routingProblems(): IterableIterator<string> {
    const instructions = fs.readFileSync(
      path.join(this.#root, "AGENTS.md"),
      "utf8"
    );
    const bullet = instructions.match(kRoutingBullet)?.[0] ?? "";
    const routed = new Set(
      Array.from(bullet.matchAll(kWorkspacePath), (match) => match[1])
    );

    for (const workspace of this.#workspaces) {
      const present = fs.existsSync(
        path.join(this.#root, workspace, "AGENTS.md")
      );
      if (present && !routed.has(workspace)) {
        yield `AGENTS.md: "${workspace}/AGENTS.md" is missing from the root routing list`;
      }
      else if (!present && routed.has(workspace)) {
        yield `AGENTS.md: the root routing list names "${workspace}", which has no AGENTS.md`;
      }
    }
  }

  #filesUnder(
    directory: string
  ): string[] {
    if (!fs.existsSync(directory)) {
      return [];
    }

    return fs.readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(
        directory,
        path.join(entry.parentPath, entry.name)
      ).split(path.sep).join("/"));
  }

  #read(
    file: string
  ): Buffer | null {
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
  }
}
