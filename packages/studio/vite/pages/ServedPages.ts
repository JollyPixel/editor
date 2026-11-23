// Import Third-party Dependencies
import type {
  Connect,
  ViteDevServer
} from "vite";
import { EDITOR_PAGE_FILE, EDITOR_PAGES_DIR } from "@jolly-pixel/server";
import {
  EditorPageFolders,
  type EditorPageSource,
  type PageEditor,
  readPathname
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import type { PageInput } from "./PageInput.ts";

export class ServedPages implements EditorPageSource {
  readonly #server: ViteDevServer;
  readonly #built = EditorPageFolders.packages();
  readonly #inputs = new Map<string, PageInput>();
  readonly #urls = new Map<string, PageInput>();

  constructor(
    server: ViteDevServer,
    inputs: Iterable<PageInput>
  ) {
    this.#server = server;
    for (const input of inputs) {
      const url = `/${input.route}/`;
      this.#inputs.set(input.route, input);
      this.#urls.set(url, input);
      this.#urls.set(`${url}${EDITOR_PAGE_FILE}`, input);
    }
  }

  html(
    editor: PageEditor
  ): Promise<string> {
    const input = this.#inputs.get(`${EDITOR_PAGES_DIR}/${editor.name}`);

    return input === undefined ?
      this.#built.html(editor) :
      this.#compile(input);
  }

  claim(
    route: string
  ): () => Promise<string> {
    const input = this.#inputs.get(route);
    if (input === undefined) {
      throw new Error(`No studio page is served at "/${route}/".`);
    }

    for (const [url, served] of this.#urls) {
      if (served === input) {
        this.#urls.delete(url);
      }
    }

    return () => this.#compile(input);
  }

  readonly middleware: Connect.NextHandleFunction = (
    request,
    response,
    next
  ) => {
    const pathname = readPathname(request);
    const input = pathname === null ? undefined : this.#urls.get(pathname);
    if (input === undefined) {
      next();

      return;
    }

    this.#compile(input).then((html) => {
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "no-cache");
      response.end(html);
    }, next);
  };

  async #compile(
    input: PageInput
  ): Promise<string> {
    return this.#server.transformIndexHtml(
      `/${input.route}/`,
      await input.loadServed()
    );
  }
}
