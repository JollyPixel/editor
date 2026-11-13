// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import type { DefaultTheme } from "vitepress";

// Import Internal Dependencies
import { packageGroups } from "./packages.mts";
import { sidebarForPackage } from "./sidebar.mts";

// CONSTANTS
const kSiteUrl = "https://jollypixel.github.io/editor/";
const kPackagesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../packages"
);

export interface LlmsSite {
  title: string;
  description: string;
}

interface DocPage {
  title: string;
  link: string;
}

export function writeLlmsFiles(
  outDir: string,
  site: LlmsSite
): void {
  const groups = packageGroups.map((group) => {
    return {
      text: group.text,
      packages: group.packages.map(({ dir, text }) => {
        return {
          text,
          pages: docPages(sidebarForPackage(dir))
        };
      })
    };
  });

  const index = [`# ${site.title}`, "", `> ${site.description}`, ""];
  const full = [`# ${site.title}`, "", `> ${site.description}`, ""];
  for (const group of groups) {
    index.push(`## ${group.text}`, "");
    for (const { text, pages } of group.packages) {
      for (const page of pages) {
        index.push(`- [${text}: ${page.title}](${pageUrl(page)})`);
        full.push(
          "---",
          "",
          `Source: ${pageUrl(page)}`,
          "",
          fs.readFileSync(pageFile(page), "utf8").trim(),
          ""
        );
      }
    }
    index.push("");
  }

  fs.writeFileSync(path.join(outDir, "llms.txt"), index.join("\n"));
  fs.writeFileSync(path.join(outDir, "llms-full.txt"), full.join("\n"));
}

function docPages(
  items: readonly DefaultTheme.SidebarItem[]
): DocPage[] {
  return items.flatMap((item) => [
    ...item.link === undefined || item.text === undefined ?
      [] :
      [{ title: item.text, link: item.link }],
    ...docPages(item.items ?? [])
  ]);
}

function pageUrl(
  page: DocPage
): string {
  return `${kSiteUrl}${page.link.slice(1)}.html`;
}

function pageFile(
  page: DocPage
): string {
  return path.join(kPackagesRoot, `${page.link.slice(1)}.md`);
}
