// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import {
  normalizePath,
  type Plugin
} from "vite";

// CONSTANTS
export const DOCS_MODULE = "virtual:jolly-pixel/docs";
const kPageQuery = "?jolly-docs";
const kResolvedModule = `\0${DOCS_MODULE}`;
const kReadme = "README.md";
const kDocsFolder = "docs";
const kFirstSection = "guides";
const kIgnoredFiles = new Set([
  "CHANGELOG.md",
  "AGENTS.md",
  "CLAUDE.md",
  "SPEC.md",
  "PLAN.md"
]);
const kLabelOverrides = new Map([
  ["ui", "UI"],
  ["api", "API"]
]);
const kAbsoluteUrl = /^(?:[a-z][a-z\d+.-]*:|\/|#)/i;
const kImageSource = /(?<=<img\b[^>]*\bsrc=")[^"]+|(?<=!\[[^\]]*\]\()[^)\s]+/g;
const kScriptDocPackages: readonly DocumentedPackage[] = [
  {
    dir: "ecs",
    label: "ECS"
  },
  {
    dir: "backend.three",
    label: "Backend Three"
  }
];

export interface DocumentedPackage {
  dir: string;
  label: string;
}

interface PageFile {
  id: string;
  file: string;
  title: string;
  folder: string | null;
}

interface SectionFiles {
  label: string | undefined;
  pages: PageFile[];
}

interface BookFiles {
  label: string;
  sections: SectionFiles[];
}

export function scriptDocs(
  packagesRoot: string,
  packages: readonly DocumentedPackage[] = kScriptDocPackages
): Plugin {
  return {
    name: "studio-script-docs",
    resolveId(id) {
      return id === DOCS_MODULE ? kResolvedModule : null;
    },
    load(id) {
      if (id === kResolvedModule) {
        const books = packages.map((entry) => bookFiles(packagesRoot, entry));
        for (const book of books) {
          for (const section of book.sections) {
            for (const page of section.pages) {
              this.addWatchFile(page.file);
            }
          }
        }

        return booksModule(books);
      }

      return id.endsWith(kPageQuery) ?
        pageModule(id.slice(0, -kPageQuery.length)) :
        null;
    }
  };
}

function bookFiles(
  packagesRoot: string,
  entry: DocumentedPackage
): BookFiles {
  const root = path.join(packagesRoot, entry.dir);
  const docs = path.join(root, kDocsFolder);
  const found = fs.existsSync(docs) ?
    fs.readdirSync(docs, { recursive: true, encoding: "utf8" }) :
    [];
  const pages = found
    .map((relative) => normalizePath(relative))
    .filter((relative) => isPage(relative))
    .map((relative): PageFile => {
      const file = path.join(docs, relative);
      const [folder, ...rest] = relative.split("/");

      return {
        id: `${entry.dir}/${kDocsFolder}/${relative}`,
        file,
        title: readTitle(file),
        folder: rest.length === 0 ? null : folder
      };
    })
    .sort(comparePages);
  const readme = path.join(root, kReadme);
  if (fs.existsSync(readme)) {
    pages.unshift({
      id: `${entry.dir}/${kReadme}`,
      file: readme,
      title: "Introduction",
      folder: null
    });
  }

  const sections = new Map<string | null, SectionFiles>();
  for (const page of pages) {
    const section = sections.get(page.folder) ?? {
      label: page.folder === null ? undefined : titleize(page.folder),
      pages: []
    };
    section.pages.push(page);
    sections.set(page.folder, section);
  }

  return {
    label: entry.label,
    sections: [...sections.values()]
  };
}

function isPage(
  relative: string
): boolean {
  return relative.endsWith(".md") &&
    !kIgnoredFiles.has(path.posix.basename(relative));
}

function readTitle(
  file: string
): string {
  const heading = /^#\s+(.+)$/m.exec(fs.readFileSync(file, "utf8"));
  if (heading !== null) {
    return heading[1].replaceAll("`", "").trim();
  }

  return titleize(path.basename(file, ".md"));
}

function titleize(
  slug: string
): string {
  return kLabelOverrides.get(slug.toLowerCase()) ?? slug
    .split(/[-_]/g)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function comparePages(
  left: PageFile,
  right: PageFile
): number {
  return folderRank(left.folder) - folderRank(right.folder) ||
    (left.folder ?? "").localeCompare(right.folder ?? "") ||
    Number(isFolderIndex(right)) - Number(isFolderIndex(left)) ||
    left.title.localeCompare(right.title);
}

function folderRank(
  folder: string | null
): number {
  if (folder === null) {
    return 0;
  }

  return folder === kFirstSection ? 1 : 2;
}

function isFolderIndex(
  page: PageFile
): boolean {
  return page.folder !== null &&
    path.basename(page.file, ".md") === page.folder;
}

function booksModule(
  books: readonly BookFiles[]
): string {
  const entries = books.map((book) => {
    const sections = book.sections.map((section) => {
      const label = section.label === undefined ?
        "" :
        `label: ${JSON.stringify(section.label)}, `;

      return `{ ${label}pages: [${section.pages.map(pageEntry).join(", ")}] }`;
    });

    return `{ label: ${JSON.stringify(book.label)}, ` +
      `sections: [${sections.join(", ")}] }`;
  });

  return `export default [${entries.join(",\n")}];\n`;
}

function pageEntry(
  page: PageFile
): string {
  const module = JSON.stringify(normalizePath(page.file) + kPageQuery);

  return `{ id: ${JSON.stringify(page.id)}, ` +
    `title: ${JSON.stringify(page.title)}, ` +
    `load: () => import(${module}).then((module) => module.default) }`;
}

function pageModule(
  file: string
): string {
  const text = fs.readFileSync(file, "utf8");
  const imports: string[] = [];
  const parts: string[] = [];
  let last = 0;
  for (const match of text.matchAll(kImageSource)) {
    const source = match[0];
    if (kAbsoluteUrl.test(source)) {
      continue;
    }
    const image = path.resolve(path.dirname(file), source);
    if (!fs.existsSync(image)) {
      continue;
    }

    const name = `image${imports.length}`;
    imports.push(
      `import ${name} from ${JSON.stringify(normalizePath(image))};`
    );
    parts.push(JSON.stringify(text.slice(last, match.index)), name);
    last = match.index + source.length;
  }
  parts.push(JSON.stringify(text.slice(last)));

  return `${imports.join("\n")}\nexport default [${parts.join(", ")}].join("");\n`;
}
