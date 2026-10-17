// Import Node.js Dependencies
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { normalizePath } from "vite";

// Import Internal Dependencies
import { EDITOR_PAGES_DIR } from "../src/editors/EditorDescriptor.ts";

// CONSTANTS
const kPageUrl = /(<(?:script|link)\b[^>]*?\b(?:src|href)=)(["'])([^"']+)\2/g;
const kExternalUrl = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export class EditorPageInput {
  readonly name: string;
  readonly id: string;
  readonly #source: string;

  constructor(
    root: string,
    name: string,
    source: string
  ) {
    this.name = name;
    this.id = normalizePath(
      path.join(root, EDITOR_PAGES_DIR, name, "index.html")
    );
    this.#source = normalizePath(source);
  }

  async load(): Promise<string> {
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

      const target = path.posix.relative(
        path.posix.dirname(this.id),
        path.posix.join(sourceDir, url)
      );

      return `${start}${quote}${target}${quote}`;
    });
  }
}
