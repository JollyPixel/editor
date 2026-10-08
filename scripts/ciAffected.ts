// Import Node.js Dependencies
import {
  execFileSync,
  execSync
} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { PnpmLockfile } from "./ci/PnpmLockfile.ts";

// CONSTANTS
const kRootDir = path.join(import.meta.dirname, "..");
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
  "scripts/ciAffected.ts"
];

interface WorkspaceProject {
  name: string;
  path: string;
}

interface PackageManifest {
  scripts?: Record<string, string>;
}

interface E2ESuite {
  name: string;
  filter: string;
  artifactPath: string;
}

function git(
  args: string[]
): string {
  return execFileSync("git", args, {
    cwd: kRootDir,
    encoding: "utf8"
  });
}

function commitExists(
  ref: string
): boolean {
  try {
    git(["cat-file", "-e", ref]);

    return true;
  }
  catch {
    return false;
  }
}

function isShared(
  file: string
): boolean {
  return kSharedPaths.some(
    (shared) => (shared.endsWith("/") ? file.startsWith(shared) : file === shared)
  );
}

function lockfileImporters(
  base: string
): Set<string> | null {
  const current = PnpmLockfile.parse(
    fs.readFileSync(path.join(kRootDir, kLockfile), "utf8")
  );

  return current.importersChangedSince(
    PnpmLockfile.parse(git(["show", `${base}:${kLockfile}`]))
  );
}

function affectedSelectors(
  base: string | undefined
): string[] | null {
  if (base === undefined || base === "" || !commitExists(base)) {
    return null;
  }

  const files = git(["diff", "--name-only", base])
    .split("\n")
    .filter(Boolean);
  if (files.some(isShared)) {
    return null;
  }
  if (!files.includes(kLockfile)) {
    return [`...[${base}]`];
  }

  const importers = lockfileImporters(base);
  if (importers === null) {
    return null;
  }

  return [
    `...[${base}]`,
    ...[...importers].map((importer) => `...{${importer}}`)
  ];
}

function workspaceProjects(
  selectors: string[] | null
): WorkspaceProject[] {
  const selector = selectors === null ?
    "-r" :
    selectors.map((filter) => `--filter "${filter}"`).join(" ");
  const output = execSync(`pnpm ${selector} ls --depth -1 --json`, {
    cwd: kRootDir,
    encoding: "utf8"
  });
  const projects: WorkspaceProject[] = JSON.parse(output);

  return projects
    .filter((project) => path.resolve(project.path) !== path.resolve(kRootDir))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function e2eSuite(
  project: WorkspaceProject
): E2ESuite | null {
  const manifest: PackageManifest = JSON.parse(
    fs.readFileSync(path.join(project.path, "package.json"), "utf8")
  );
  if (manifest.scripts?.["test:e2e"] === undefined) {
    return null;
  }

  const directory = path.relative(kRootDir, project.path)
    .split(path.sep)
    .join("/");

  return {
    name: path.posix.basename(directory),
    filter: project.name,
    artifactPath: `${directory}/test-results`
  };
}

function pnpmFilters(
  selectors: string[] | null,
  projects: WorkspaceProject[],
  suffix: string
): string {
  if (selectors === null) {
    return "-r";
  }

  return projects
    .map((project) => `--filter=${project.name}${suffix}`)
    .join(" ");
}

const { values } = parseArgs({
  options: {
    base: {
      type: "string"
    },
    "skip-e2e": {
      type: "string",
      multiple: true,
      default: []
    }
  }
});

const skipped = new Set(values["skip-e2e"]);
const selectors = affectedSelectors(values.base);
const projects = workspaceProjects(selectors);
const suites = projects
  .filter((project) => !skipped.has(project.name))
  .map(e2eSuite)
  .filter((suite) => suite !== null);

console.log(`e2e=${JSON.stringify(suites)}`);
console.log(`test=${pnpmFilters(selectors, projects, "")}`);
console.log(`build=${pnpmFilters(selectors, projects, "...")}`);
