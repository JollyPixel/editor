// Import Node.js Dependencies
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Import Internal Dependencies
import { ROOT_DIR } from "../workspace/root.ts";
import { PnpmLockfile } from "./PnpmLockfile.ts";

// CONSTANTS
const kLockfile = "pnpm-lock.yaml";
const kSharedPaths = [
  "package.json",
  ".npmrc",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig/",
  ".github/actions/",
  ".github/workflows/node.js.yml",
  "scripts/ci/",
  "scripts/workspace/"
];

export class ChangeSet {
  static readonly workspaceLocalPatterns: readonly string[] = [
    "packages/**/test/**",
    "packages/**/docs/**"
  ];

  static since(
    base: string | undefined
  ): ChangeSet | null {
    const commit = base === undefined || base === "" ? null : ChangeSet.#commit(base);
    if (commit === null) {
      return null;
    }

    const files = ChangeSet.#git(["diff", "--name-only", commit])
      .split("\n")
      .filter(Boolean);
    const lockfileImporters = files.includes(kLockfile) ?
      ChangeSet.#lockfileImporters(commit) :
      new Set<string>();

    return new ChangeSet(commit, files, lockfileImporters);
  }

  static #lockfileImporters(
    base: string
  ): Set<string> | null {
    const current = PnpmLockfile.parse(
      fs.readFileSync(path.join(ROOT_DIR, kLockfile), "utf8")
    );

    return current.importersChangedSince(
      PnpmLockfile.parse(ChangeSet.#git(["show", `${base}:${kLockfile}`]))
    );
  }

  static #git(
    args: string[]
  ): string {
    return execFileSync("git", args, {
      cwd: ROOT_DIR,
      encoding: "utf8"
    });
  }

  static #commit(
    ref: string
  ): string | null {
    try {
      return ChangeSet.#git(
        ["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`]
      ).trim();
    }
    catch {
      return null;
    }
  }

  static #isShared(
    file: string
  ): boolean {
    return kSharedPaths.some(
      (shared) => (shared.endsWith("/") ? file.startsWith(shared) : file === shared)
    );
  }

  readonly base: string;
  readonly files: readonly string[];
  readonly lockfileImporters: ReadonlySet<string> | null;

  constructor(
    base: string,
    files: readonly string[],
    lockfileImporters: ReadonlySet<string> | null
  ) {
    this.base = base;
    this.files = files;
    this.lockfileImporters = lockfileImporters;
  }

  selectors(): string[] | null {
    if (this.lockfileImporters === null || this.files.some(ChangeSet.#isShared)) {
      return null;
    }

    return [
      `...[${this.base}]`,
      ...[...this.lockfileImporters].map((importer) => `...{${importer}}`)
    ];
  }
}
