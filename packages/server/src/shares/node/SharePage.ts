// Import Node.js Dependencies
import type { IncomingMessage } from "node:http";

// Import Third-party Dependencies
import { launchElement } from "@jolly-pixel/asset-server";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";

// Import Internal Dependencies
import { EDITOR_PAGES_PATH } from "../../editors/EditorDescriptor.ts";
import { insertInHead } from "../../http/insertInHead.ts";
import type { Middleware } from "../../http/node/Middleware.ts";
import { VIEW_PAGES_PREFIX } from "../api.ts";
import type { EditorPageSource } from "../../editors/node/EditorPageFolders.ts";
import type { EditorPackages } from "../../editors/node/EditorPackages.ts";
import { readPathname } from "../../http/node/requestPathname.ts";
import { sendHtml } from "../../http/node/sendHtml.ts";
import type { ProjectShares } from "./ProjectShares.ts";

// CONSTANTS
const kProjectRoot = "..";
const kNotFoundPage = "<!doctype html><html lang=\"en\"><head>" +
  "<meta charset=\"utf-8\"><title>Link unavailable</title></head>" +
  "<body><p>This share link has expired or was revoked.</p></body></html>";

export interface SharePageOptions {
  shares: ProjectShares;
  editors: EditorPackages;
  pages: EditorPageSource;
}

export class SharePage {
  readonly middleware: Middleware;

  #shares: ProjectShares;
  #editors: EditorPackages;
  #pages: EditorPageSource;

  constructor(
    options: SharePageOptions
  ) {
    this.#shares = options.shares;
    this.#editors = options.editors;
    this.#pages = options.pages;
    this.middleware = (request, response, next) => {
      const token = this.#tokenIn(request);
      if (token === null) {
        next();

        return;
      }

      this.render(token).then(
        (html) => sendHtml(response, html === null ? 404 : 200, html ?? kNotFoundPage),
        () => sendHtml(response, 500, kNotFoundPage)
      );
    };
  }

  async render(
    token: string
  ): Promise<string | null> {
    const shared = this.#shares.opened(token);
    if (shared === null) {
      return null;
    }
    const editor = this.#editors.forKind(shared.kind);
    if (editor === undefined) {
      return null;
    }

    return insertInHead(
      await this.#pages.html(editor),
      `<base href="${kProjectRoot}/${EDITOR_PAGES_PATH}${editor.name}/">` +
      launchElement({
        target: shared.assetId,
        credential: token,
        socket: `${kProjectRoot}${DEFAULT_WEBSOCKET_PATH}`
      })
    );
  }

  #tokenIn(
    request: IncomingMessage
  ): string | null {
    const pathname = readPathname(request);

    return pathname?.startsWith(VIEW_PAGES_PREFIX) ?
      pathname.slice(VIEW_PAGES_PREFIX.length) :
      null;
  }
}
