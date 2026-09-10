// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import type { DefaultTheme } from "vitepress";

const kPackagesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../packages"
);

// CONSTANTS
const kIgnoredFiles = new Set([
  "CHANGELOG.md",
  "AGENTS.md",
  "CLAUDE.md",
  "SPEC.md",
  "PLAN.md"
]);

const kTitleOverrides = new Map([
  ["api", "API"],
  ["adr", "ADR"],
  ["ui", "UI"],
  ["uv", "UV"],
  ["dom", "DOM"],
  ["asset-server", "Asset Server"],
  ["tiled", "Tiled"]
]);

const kRootFiles = new Map([
  ["README.md", "Introduction"],
  ["ARCHITECTURE.md", "Architecture"],
  ["CATALOG_WRITE_PATH.md", "Catalog write path"],
  ["GLOSSARY.md", "Glossary"]
]);

const kSectionWeight = new Map([
  ["guides", 0],
  ["concepts", 10],
  ["api", 20],
  ["adr", 90]
]);

function titleize(
  slug: string
): string {
  const override = kTitleOverrides.get(slug.toLowerCase());
  if (override) {
    return override;
  }

  return slug
    .split(/[-_]/g)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function readTitle(
  filePath: string
): string {
  const raw = fs.readFileSync(filePath, "utf8");
  const heading = /^#\s+(.+)$/m.exec(raw);
  if (heading) {
    return heading[1].replace(/`/g, "").trim();
  }

  return titleize(path.basename(filePath, ".md"));
}

function isIndexFile(
  name: string
): boolean {
  return name === "index.md" || name === "README.md";
}

function toLink(
  packageName: string,
  absolutePath: string
): string {
  const relative = path
    .relative(path.join(kPackagesRoot, packageName), absolutePath)
    .split(path.sep)
    .join("/");

  return `/${packageName}/${relative.slice(0, -".md".length)}`;
}

function walk(
  packageName: string,
  directory: string,
  depth: number
): DefaultTheme.SidebarItem[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !kIgnoredFiles.has(entry.name))
    .sort((a, b) => {
      if (isIndexFile(a.name) !== isIndexFile(b.name)) {
        return isIndexFile(a.name) ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    })
    .map((entry): DefaultTheme.SidebarItem => {
      const absolutePath = path.join(directory, entry.name);

      return {
        text: readTitle(absolutePath),
        link: toLink(packageName, absolutePath)
      };
    });

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => {
      const weight = (kSectionWeight.get(a.name) ?? 50) - (kSectionWeight.get(b.name) ?? 50);

      return weight === 0 ? a.name.localeCompare(b.name) : weight;
    })
    .flatMap((entry): DefaultTheme.SidebarItem[] => {
      const items = walk(packageName, path.join(directory, entry.name), depth + 1);
      if (items.length === 0) {
        return [];
      }

      return [{
        text: titleize(entry.name),
        collapsed: depth > 0,
        items
      }];
    });

  return [...files, ...directories];
}

export function sidebarForPackage(
  packageName: string
): DefaultTheme.SidebarItem[] {
  const packageDir = path.join(kPackagesRoot, packageName);
  const items: DefaultTheme.SidebarItem[] = [];

  for (const [fileName, text] of kRootFiles) {
    if (fs.existsSync(path.join(packageDir, fileName))) {
      items.push({
        text,
        link: `/${packageName}/${fileName.slice(0, -".md".length)}`
      });
    }
  }

  const docsDir = path.join(packageDir, "docs");
  if (fs.existsSync(docsDir)) {
    items.push(...walk(packageName, docsDir, 0));
  }

  return items;
}

export function sidebarForPackages(
  packageNames: readonly string[]
): DefaultTheme.Sidebar {
  return Object.fromEntries(
    packageNames.map((packageName) => [
      `/${packageName}/`,
      [{ items: sidebarForPackage(packageName) }]
    ])
  );
}
