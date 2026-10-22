// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import { launchElement } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { EDITOR_PAGES_PATH } from "../../shared/EditorDescriptor.ts";
import { VIEW_PAGES_PREFIX } from "../../shared/api/shares.ts";
import type { EditorPackages } from "../editors/EditorPackages.ts";
import type { StudioShares } from "./StudioShares.ts";

// CONSTANTS
const kInjectAfter = [
  /<head(?:\s[^>]*)?>/i,
  /<!doctype[^>]*>/i
];
const kSecurityHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};
const kNotFoundPage = "<!doctype html><html lang=\"en\"><head>" +
  "<meta charset=\"utf-8\"><title>Link unavailable</title></head>" +
  "<body><p>This share link has expired or was revoked.</p></body></html>";

export type SharePageMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;

export interface SharePageOptions {
  shares: StudioShares;
  editors: EditorPackages;
}

export class SharePage {
  readonly middleware: SharePageMiddleware;

  #shares: StudioShares;
  #editors: EditorPackages;

  constructor(
    options: SharePageOptions
  ) {
    this.#shares = options.shares;
    this.#editors = options.editors;
    this.middleware = (request, response, next) => {
      const token = this.#tokenIn(request);
      if (token === null) {
        next();

        return;
      }

      this.render(token).then(
        (html) => send(response, html === null ? 404 : 200, html ?? kNotFoundPage),
        () => send(response, 500, kNotFoundPage)
      );
    };
  }

  async render(
    token: string
  ): Promise<string | null> {
    const shared = await this.#shares.opened(token);
    if (shared === null) {
      return null;
    }
    const editor = this.#editors.forKind(shared.kind);
    if (editor === undefined) {
      return null;
    }

    const page = await fs.readFile(
      path.join(editor.dist, "index.html"),
      "utf8"
    );
    const injected = `<base href="../${EDITOR_PAGES_PATH}${editor.name}/">` +
      launchElement({
        target: shared.assetId,
        credential: token
      });

    const anchor = kInjectAfter.find((pattern) => pattern.test(page));

    return anchor === undefined ?
      injected + page :
      page.replace(anchor, (tag) => tag + injected);
  }

  #tokenIn(
    request: IncomingMessage
  ): string | null {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return null;
    }

    const pathname = URL.parse(
      request.url ?? "/",
      "http://localhost"
    )?.pathname ?? "/";

    return pathname.startsWith(VIEW_PAGES_PREFIX) ?
      pathname.slice(VIEW_PAGES_PREFIX.length) :
      null;
  }
}

function send(
  response: ServerResponse,
  status: number,
  html: string
): void {
  response.statusCode = status;
  response.setHeader("content-type", "text/html; charset=utf-8");
  for (const [name, value] of Object.entries(kSecurityHeaders)) {
    response.setHeader(name, value);
  }
  response.end(html);
}
