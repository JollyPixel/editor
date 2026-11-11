// Import Node.js Dependencies
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { normalizePath } from "vite";
import { EDITOR_PAGE_FILE, EDITOR_PAGES_DIR } from "@jolly-pixel/server";
import type { EditorPackage } from "@jolly-pixel/server/node";

// CONSTANTS
const kPageUrl = /(<(?:script|link)\b[^>]*?\b(?:src|href)=)(["'])([^"']+)\2/g;
const kExternalUrl = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const kServedFilePrefix = "/@fs";

export class EditorPageInput {
  static compiled(
    root: string,
    editors: Iterable<EditorPackage>
  ): EditorPageInput[] {
    return Array.from(editors).flatMap(({ name, page }) => (
      page.kind === "source" ?
        [new EditorPageInput(root, name, page.html)] :
        []
    ));
  }

  readonly name: string;
  readonly id: string;
  readonly entry: string;
  readonly #source: string;

  constructor(
    root: string,
    name: string,
    source: string
  ) {
    this.name = name;
    this.id = normalizePath(
      path.join(root, EDITOR_PAGES_DIR, name, EDITOR_PAGE_FILE)
    );
    this.#source = normalizePath(source);
    this.entry = path.posix.relative(normalizePath(root), this.#source);
  }

  load(): Promise<string> {
    const pageDir = path.posix.dirname(this.id);

    return this.#rewrite(
      (file) => path.posix.relative(pageDir, file)
    );
  }

  loadServed(): Promise<string> {
    return this.#rewrite(
      (file) => path.posix.join(kServedFilePrefix, file)
    );
  }

  async #rewrite(
    locate: (file: string) => string
  ): Promise<string> {
    const html = await fs.readFile(this.#source, "utf8");
    const sourceDir = path.posix.dirname(this.#source);

    return html.replace(kPageUrl, (match, start, quote, url) => {
      if (kExternalUrl.test(url)) {
        return match;
      }
      if (url.startsWith("/")) {
        throw new TypeError(
          `"${this.#source}" references "${url}": editor pages use relative URLs.`
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
