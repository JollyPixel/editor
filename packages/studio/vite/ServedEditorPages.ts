// Import Third-party Dependencies
import type {
  Connect,
  ViteDevServer
} from "vite";
import { EDITOR_PAGE_FILE, EDITOR_PAGES_PREFIX } from "@jolly-pixel/server";
import {
  EditorPageFolders,
  type EditorPageSource,
  type PageEditor,
  readPathname
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import type { EditorPageInput } from "./EditorPageInput.ts";

export class ServedEditorPages implements EditorPageSource {
  readonly #server: ViteDevServer;
  readonly #built = EditorPageFolders.packages();
  readonly #inputs = new Map<string, EditorPageInput>();
  readonly #routes = new Map<string, EditorPageInput>();

  constructor(
    server: ViteDevServer,
    inputs: Iterable<EditorPageInput>
  ) {
    this.#server = server;
    for (const input of inputs) {
      const url = `${EDITOR_PAGES_PREFIX}${input.name}/`;
      this.#inputs.set(input.name, input);
      this.#routes.set(url, input);
      this.#routes.set(`${url}${EDITOR_PAGE_FILE}`, input);
    }
  }

  html(
    editor: PageEditor
  ): Promise<string> {
    const input = this.#inputs.get(editor.name);

    return input === undefined ?
      this.#built.html(editor) :
      this.#compile(input);
  }

  readonly middleware: Connect.NextHandleFunction = (
    request,
    response,
    next
  ) => {
    const pathname = readPathname(request);
    const input = pathname === null ? undefined : this.#routes.get(pathname);
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
    input: EditorPageInput
  ): Promise<string> {
    return this.#server.transformIndexHtml(
      `${EDITOR_PAGES_PREFIX}${input.name}/`,
      await input.loadServed()
    );
  }
}
