// Import Node.js Dependencies
import {
  globSync,
  readFileSync
} from "node:fs";
import path from "node:path";

// CONSTANTS
const kRepositoryRoot = path.join(import.meta.dirname, "..", "..", "..", "..");
const kSources = {
  typescript: "packages/{editors/script,assets/script,scripting}/src/**/*.ts",
  markdown: "packages/*/{README.md,docs/**/*.md}",
  json: "packages/**/package.json"
} as const;

export type FixtureLanguage = keyof typeof kSources;

export function fixtureText(
  language: FixtureLanguage,
  bytes: number
): string {
  const files = globSync(kSources[language], {
    cwd: kRepositoryRoot,
    exclude: (file) => file.includes("node_modules")
  }).sort();
  let text = "";
  for (let index = 0; text.length < bytes; index++) {
    const file = files[index % files.length];
    text += readFileSync(path.join(kRepositoryRoot, file), "utf8").replaceAll("\r\n", "\n");
  }
  const lineEnd = text.indexOf("\n", bytes);

  return lineEnd === -1 ? text : text.slice(0, lineEnd + 1);
}
