// Import Node.js Dependencies
import {
  globSync,
  readFileSync
} from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";

// Import Internal Dependencies
import { STUDIO_ROOT } from "../../node/studioFiles.ts";

// CONSTANTS
const kRepositoryRoot = path.join(STUDIO_ROOT, "..", "..");
const kScriptSources = "packages/{editors/script,assets/script,scripting}/src/**/*.ts";
const kMarkdownSources = "packages/*/{README.md,docs/**/*.md}";
const kPackageManifests = "packages/**/package.json";
const kEncoder = new TextEncoder();

export type FixtureFormat = "typescript" | "javascript" | "markdown" | "json";

export function fixtureContent(
  format: FixtureFormat,
  bytes: number
): Uint8Array {
  return kEncoder.encode(fixtureText(format, bytes));
}

function fixtureText(
  format: FixtureFormat,
  bytes: number
): string {
  switch (format) {
    case "typescript":
      return joinedUntil(repositoryFiles(kScriptSources), bytes);
    case "javascript":
      return joinedUntil(
        repositoryFiles(kScriptSources).map((source) => stripTypeScriptTypes(source)),
        bytes
      );
    case "markdown":
      return joinedUntil(repositoryFiles(kMarkdownSources), bytes);
    case "json":
      return manifestList(bytes);
  }
}

function manifestList(
  bytes: number
): string {
  const items = repositoryFiles(kPackageManifests).map(
    (manifest) => `  ${JSON.stringify(JSON.parse(manifest), null, 2).replaceAll("\n", "\n  ")}`
  );
  const list: string[] = [];
  let length = 0;
  while (length < bytes) {
    const item = items[list.length % items.length];
    list.push(item);
    length += item.length + 2;
  }

  return `[\n${list.join(",\n")}\n]\n`;
}

function repositoryFiles(
  pattern: string
): string[] {
  const files = globSync(pattern, {
    cwd: kRepositoryRoot,
    exclude: (file) => file.includes("node_modules")
  }).sort();
  if (files.length === 0) {
    throw new Error(`No repository file matches "${pattern}"`);
  }

  return files.map(
    (file) => readFileSync(path.join(kRepositoryRoot, file), "utf8").replaceAll("\r\n", "\n")
  );
}

function joinedUntil(
  parts: readonly string[],
  bytes: number
): string {
  let text = parts[0];
  for (let index = 1; text.length < bytes; index++) {
    text += `\n${parts[index % parts.length]}`;
  }
  const lineEnd = text.indexOf("\n", bytes);

  return lineEnd === -1 ? text : text.slice(0, lineEnd + 1);
}
