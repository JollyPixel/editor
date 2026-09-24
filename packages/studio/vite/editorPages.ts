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

// Import Internal Dependencies
import {
  EDITOR_PAGES_PREFIX,
  type EditorDescriptor
} from "../src/editors/EditorDescriptor.ts";

export { EDITOR_PAGES_PREFIX };

// CONSTANTS
export const EDITORS_MODULE_ID = "virtual:jolly-pixel/editors";
export const EDITOR_MANIFEST_FIELD = "jollypixel";
const kResolvedEditorsModuleId = `\0${EDITORS_MODULE_ID}`;
const kEditorName = /^[a-z0-9][a-z0-9-]*$/;
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

export interface EditorPackage extends EditorDescriptor {
  package: string;
  /**
   * Absolute path of the built page folder.
   */
  dist: string;
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
  editors: readonly EditorPackage[];
  prefix?: string;
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

/**
 * Reads the `jollypixel.editor` field of each package's `package.json`:
 * `{ name, kinds, dist? }`, where `dist` is relative to the package root and
 * defaults to `"dist"`.
 */
export function readEditorPackages(
  packageNames: Iterable<string>,
  locate: PackageLocator = locatePackage
): EditorPackage[] {
  const editors: EditorPackage[] = [];
  const names = new Set<string>();
  for (const packageName of packageNames) {
    const editor = readEditorPackage(packageName, locate(packageName));
    if (names.has(editor.name)) {
      throw new TypeError(
        `Editor "${editor.name}" is declared by more than one package.`
      );
    }

    names.add(editor.name);
    editors.push(editor);
  }

  return editors;
}

export function resolveEditorPages(
  editors: Iterable<EditorPackage>
): Map<string, string> {
  return new Map(
    Array.from(editors, (editor) => [editor.name, editor.dist])
  );
}

export function editorsModule(
  editors: Iterable<EditorDescriptor>
): string {
  const descriptors = Array.from(editors, ({ name, kinds }) => {
    return {
      name,
      kinds
    };
  });

  return `export default ${JSON.stringify(descriptors)};\n`;
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
    resolveId(id) {
      return id === EDITORS_MODULE_ID ? kResolvedEditorsModuleId : null;
    },
    load(id) {
      return id === kResolvedEditorsModuleId ?
        editorsModule(options.editors) :
        null;
    },
    configureServer(server) {
      server.middlewares.use(
        createEditorPagesHandler({
          pages: resolveEditorPages(options.editors),
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

function readEditorPackage(
  packageName: string,
  root: string
): EditorPackage {
  const manifest: unknown = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  const field = isRecord(manifest) ? manifest[EDITOR_MANIFEST_FIELD] : null;
  const editor = isRecord(field) ? field.editor : null;
  if (!isRecord(editor)) {
    throw new TypeError(
      `"${packageName}" declares no "${EDITOR_MANIFEST_FIELD}.editor" manifest.`
    );
  }

  const { name, kinds, dist = kDefaultDist } = editor;
  if (typeof name !== "string" || !kEditorName.test(name)) {
    throw new TypeError(
      `"${packageName}" declares an invalid editor name.`
    );
  }
  if (!isStringArray(kinds) || kinds.length === 0) {
    throw new TypeError(
      `"${packageName}" must declare the asset kinds its editor opens.`
    );
  }
  if (typeof dist !== "string") {
    throw new TypeError(
      `"${packageName}" declares an invalid editor dist folder.`
    );
  }

  return {
    package: packageName,
    name,
    kinds: [...kinds],
    dist: path.resolve(root, dist)
  };
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(
  value: unknown
): value is string[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item !== "");
}
