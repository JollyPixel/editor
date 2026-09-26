// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// CONSTANTS
const kRootDir = path.join(import.meta.dirname, "..");
const kSubpathSegment = /^[a-z][a-z0-9-]*$/;

interface PackageManifest {
  name: string;
  private?: boolean;
  main?: string;
  types?: string;
  exports?: Record<string, unknown>;
}

interface ConditionalTarget {
  types: string;
  default: string;
}

function workspaceDirectories(): string[] {
  const workspace = fs.readFileSync(
    path.join(kRootDir, "pnpm-workspace.yaml"),
    "utf8"
  );
  const globs = [...workspace.matchAll(/^\s+-\s+(\S+)\/\*\s*$/gm)]
    .map((match) => match[1]);

  return globs.flatMap((glob) => {
    const parent = path.join(kRootDir, glob);

    return fs.readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(parent, entry.name))
      .filter((directory) => fs.existsSync(path.join(directory, "package.json")));
  });
}

function isConditionalTarget(
  target: unknown
): target is ConditionalTarget {
  return typeof target === "object" &&
    target !== null &&
    Object.keys(target).join(",") === "types,default" &&
    typeof (target as ConditionalTarget).types === "string" &&
    typeof (target as ConditionalTarget).default === "string";
}

function sourceOf(
  target: string
): string {
  return target.startsWith("./dist/") ?
    target.replace("./dist/", "./src/").replace(/\.js$/, ".ts") :
    target;
}

function checkSubpath(
  subpath: string
): string | null {
  if (subpath === ".") {
    return null;
  }
  const segments = subpath.split("/");
  if (segments[0] !== "." || segments.length < 2) {
    return `"${subpath}" must start with "./"`;
  }

  return segments.slice(1).every((segment) => kSubpathSegment.test(segment)) ?
    null :
    `"${subpath}" must use lowercase names with no extension or wildcard`;
}

function checkTarget(
  directory: string,
  subpath: string,
  target: unknown
): string[] {
  if (typeof target === "string") {
    return target.startsWith("./src/") && target.endsWith(".ts") &&
      fs.existsSync(path.join(directory, target)) ?
      [] :
      [`"${subpath}" string target must be an existing ./src/*.ts file`];
  }
  if (!isConditionalTarget(target)) {
    return [`"${subpath}" target must be { types, default }`];
  }

  const problems: string[] = [];
  if (target.types !== target.default.replace(/\.js$/, ".d.ts")) {
    problems.push(`"${subpath}" types must mirror its default target`);
  }
  if (!fs.existsSync(path.join(directory, sourceOf(target.default)))) {
    problems.push(`"${subpath}" has no source file for ${target.default}`);
  }

  return problems;
}

function checkManifest(
  directory: string
): string[] {
  const manifest: PackageManifest = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf8")
  );
  if (manifest.exports === undefined) {
    return manifest.private ?
      [] :
      [`${manifest.name}: published packages must declare "exports"`];
  }

  const problems: string[] = [];
  if (manifest.main !== undefined || manifest.types !== undefined) {
    problems.push(`${manifest.name}: drop "main" and "types" in favor of "exports"`);
  }
  if (!Object.hasOwn(manifest.exports, ".")) {
    problems.push(`${manifest.name}: "exports" must declare "."`);
  }
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    const subpathProblem = checkSubpath(subpath);
    if (subpathProblem !== null) {
      problems.push(`${manifest.name}: ${subpathProblem}`);
    }
    for (const problem of checkTarget(directory, subpath, target)) {
      problems.push(`${manifest.name}: ${problem}`);
    }
  }

  return problems;
}

const problems = workspaceDirectories().flatMap(checkManifest);
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
}
