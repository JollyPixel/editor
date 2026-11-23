// Import Node.js Dependencies
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  normalizePath,
  type Plugin
} from "vite";
import { EDITOR_PAGE_FILE, EDITOR_PAGES_DIR } from "@jolly-pixel/server";
import type { EditorPackage } from "@jolly-pixel/server/node";

// CONSTANTS
export const SHELL_PAGES_DIR = "pages";

const kHtmlFile = /\.html$/;
const kPageUrl = /(<(?:script|link)\b[^>]*?\b(?:src|href)=)(["'])([^"']+)\2/g;
const kExternalUrl = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const kServedFilePrefix = "/@fs";

export class PageInput {
  static editors(
    root: string,
    editors: Iterable<EditorPackage>
  ): PageInput[] {
    return Array.from(editors).flatMap(({ name, page }) => (
      page.kind === "source" ?
        [new PageInput(root, `${EDITOR_PAGES_DIR}/${name}`, page.html, name)] :
        []
    ));
  }

  static shell(
    root: string,
    route: string
  ): PageInput {
    return new PageInput(
      root,
      route,
      path.join(root, SHELL_PAGES_DIR, `${route}.html`),
      route
    );
  }

  readonly name: string;
  readonly route: string;
  readonly id: string;
  readonly source: string;
  readonly entry: string;
  readonly #root: string;

  constructor(
    root: string,
    route: string,
    source: string,
    name: string
  ) {
    this.#root = normalizePath(root);
    this.name = name;
    this.route = route;
    this.id = path.posix.join(this.#root, route, EDITOR_PAGE_FILE);
    this.source = normalizePath(source);
    this.entry = path.posix.relative(this.#root, this.source);
  }

  load(): Promise<string> {
    const pageDir = path.posix.dirname(this.id);

    return this.#rewrite(
      (file) => path.posix.relative(pageDir, file)
    );
  }

  loadServed(): Promise<string> {
    return this.#rewrite((file) => {
      const fromRoot = path.posix.relative(this.#root, file);

      return fromRoot.startsWith("..") ?
        path.posix.join(kServedFilePrefix, file) :
        `/${fromRoot}`;
    });
  }

  async #rewrite(
    locate: (file: string) => string
  ): Promise<string> {
    const html = await fs.readFile(this.source, "utf8");
    const sourceDir = path.posix.dirname(this.source);

    return html.replace(kPageUrl, (match, start, quote, url) => {
      if (kExternalUrl.test(url)) {
        return match;
      }
      if (url.startsWith("/")) {
        throw new TypeError(
          `"${this.source}" references "${url}": studio pages use relative URLs.`
        );
      }
      if (existsSync(path.posix.join(sourceDir, "public", url))) {
        return match;
      }

      const target = locate(path.posix.join(sourceDir, url));

      return `${start}${quote}${target}${quote}`;
    });
  }
}

export function virtualPages(
  inputs: ReadonlyMap<string, PageInput>
): Pick<Plugin, "resolveId" | "load"> {
  return {
    resolveId: {
      filter: {
        id: kHtmlFile
      },
      handler(id) {
        const normalized = normalizePath(id);

        return inputs.has(normalized) ? normalized : null;
      }
    },
    load: {
      filter: {
        id: kHtmlFile
      },
      handler(id) {
        return inputs.get(id)?.load() ?? null;
      }
    }
  };
}
