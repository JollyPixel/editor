// Import Node.js Dependencies
import {
  execFileSync,
  execSync
} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// CONSTANTS
const kRootDir = path.join(import.meta.dirname, "..");
const kSharedPaths = [
  "package.json",
  ".npmrc",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "tsconfig/",
  ".github/actions/",
  ".github/workflows/node.js.yml",
  "scripts/ciE2eMatrix.ts"
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

function touchesSharedPaths(
  base: string
): boolean {
  const files = git(["diff", "--name-only", base])
    .split("\n")
    .filter(Boolean);

  return files.some((file) => kSharedPaths.some(
    (shared) => (shared.endsWith("/") ? file.startsWith(shared) : file === shared)
  ));
}

function affectedBase(
  base: string | undefined
): string | null {
  if (base === undefined || !commitExists(base) || touchesSharedPaths(base)) {
    return null;
  }

  return base;
}

function workspaceProjects(
  base: string | null
): WorkspaceProject[] {
  const selector = base === null ? "-r" : `--filter "...[${base}]"`;
  const output = execSync(`pnpm ${selector} ls --depth -1 --json`, {
    cwd: kRootDir,
    encoding: "utf8"
  });

  return JSON.parse(output);
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

const { values } = parseArgs({
  options: {
    base: {
      type: "string"
    },
    skip: {
      type: "string",
      multiple: true,
      default: []
    }
  }
});

const skipped = new Set(values.skip);
const suites = workspaceProjects(affectedBase(values.base))
  .filter((project) => !skipped.has(project.name))
  .map(e2eSuite)
  .filter((suite) => suite !== null)
  .sort((left, right) => left.name.localeCompare(right.name));

console.log(JSON.stringify(suites));
