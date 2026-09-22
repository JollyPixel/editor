// Import Node.js Dependencies
import fs from "node:fs";
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

// Import Third-party Dependencies
import type {
  Connect,
  Plugin
} from "vite";

// CONSTANTS
export const EDITOR_PAGES_PREFIX = "/editors/";
const kIndexFile = "index.html";
const kDefaultDist = "dist";
const kFallbackContentType = "application/octet-stream";
const kContentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export interface EditorPage {
  name: string;
  package: string;
  /**
   * Built page folder, relative to the package root.
   * @default "dist"
   */
  dist?: string;
}

export type PackageLocator = (packageName: string) => string;

export interface EditorPagesHandlerOptions {
  pages: ReadonlyMap<string, string>;
  /**
   * @default EDITOR_PAGES_PREFIX
   */
  prefix?: string;
}

export interface EditorPagesPluginOptions {
  pages: Iterable<EditorPage>;
  prefix?: string;
  locate?: PackageLocator;
}

interface PageRoute {
  name: string;
  file: string | null;
  search: string;
}

export function locatePackage(
  packageName: string
): string {
  const require = createRequire(import.meta.url);

  return path.dirname(require.resolve(`${packageName}/package.json`));
}

export function resolveEditorPages(
  pages: Iterable<EditorPage>,
  locate: PackageLocator = locatePackage
): Map<string, string> {
  const resolved = new Map<string, string>();
  for (const page of pages) {
    resolved.set(
      page.name,
      path.resolve(locate(page.package), page.dist ?? kDefaultDist)
    );
  }

  return resolved;
}

export function createEditorPagesHandler(
  options: EditorPagesHandlerOptions
): Connect.NextHandleFunction {
  const {
    pages,
    prefix = EDITOR_PAGES_PREFIX
  } = options;

  return (request, response, next) => {
    const route = parseRoute(request, prefix);
    if (
      route === null ||
      (request.method !== "GET" && request.method !== "HEAD")
    ) {
      next();

      return;
    }

    const dist = pages.get(route.name);
    if (dist === undefined) {
      reply(response, 404);

      return;
    }
    if (route.file === null) {
      response.writeHead(302, {
        location: `${prefix}${route.name}/${route.search}`
      });
      response.end();

      return;
    }

    const file = resolveFile(dist, route.file);
    if (file === null) {
      reply(response, 403);

      return;
    }

    void serveFile(file, request, response);
  };
}

export function editorPagesPlugin(
  options: EditorPagesPluginOptions
): Plugin {
  return {
    name: "studio-editor-pages",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        createEditorPagesHandler({
          pages: resolveEditorPages(options.pages, options.locate),
          prefix: options.prefix
        })
      );
    }
  };
}

function parseRoute(
  request: IncomingMessage,
  prefix: string
): PageRoute | null {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith(prefix)) {
    return null;
  }

  const remaining = url.pathname.slice(prefix.length);
  const slash = remaining.indexOf("/");
  if (slash === -1) {
    return remaining === "" ?
      null :
      {
        name: remaining,
        file: null,
        search: url.search
      };
  }

  return {
    name: remaining.slice(0, slash),
    file: remaining.slice(slash + 1),
    search: url.search
  };
}

function resolveFile(
  dist: string,
  requested: string
): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requested);
  }
  catch {
    return null;
  }
  if (decoded.includes("\0")) {
    return null;
  }

  const file = path.resolve(
    dist,
    decoded === "" || decoded.endsWith("/") ?
      `${decoded}${kIndexFile}` :
      decoded
  );
  const relative = path.relative(dist, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return file;
}

async function serveFile(
  requested: string,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  let file = requested;
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(file);
    if (stats.isDirectory()) {
      file = path.join(file, kIndexFile);
      stats = await fs.promises.stat(file);
    }
  }
  catch {
    reply(response, 404);

    return;
  }

  response.writeHead(200, {
    "content-type": kContentTypes[path.extname(file)] ?? kFallbackContentType,
    "content-length": stats.size,
    "cache-control": "no-cache"
  });
  if (request.method === "HEAD") {
    response.end();

    return;
  }

  fs.createReadStream(file)
    .once("error", () => response.destroy())
    .pipe(response);
}

function reply(
  response: ServerResponse,
  status: number
): void {
  response.statusCode = status;
  response.end();
}
