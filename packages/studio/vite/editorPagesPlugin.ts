// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage } from "node:http";

// Import Third-party Dependencies
import sirv from "sirv";
import type {
  Connect,
  Plugin
} from "vite";

// Import Internal Dependencies
import {
  EDITOR_PAGES_DIR,
  EDITOR_PAGES_PREFIX,
  type EditorDescriptor
} from "../src/editors/EditorDescriptor.ts";
import type { EditorPackage } from "./editorManifest.ts";

// CONSTANTS
export const EDITORS_MODULE_ID = "virtual:jolly-pixel/editors";
const kResolvedEditorsModuleId = `\0${EDITORS_MODULE_ID}`;

interface PageRoute {
  name: string;
  file: string | null;
  search: string;
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
  editors: Iterable<EditorPackage>
): Connect.NextHandleFunction {
  const pages = new Map(
    Array.from(editors, (editor) => [
      editor.name,
      sirv(editor.dist, {
        dev: true,
        etag: true
      })
    ])
  );

  return (request, response, next) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      next();

      return;
    }

    const route = parseRoute(request);
    if (route === null) {
      next();

      return;
    }

    const serve = pages.get(route.name);
    if (serve === undefined) {
      response.statusCode = 404;
      response.end();

      return;
    }
    if (route.file === null) {
      response.writeHead(302, {
        location: `${EDITOR_PAGES_PREFIX}${route.name}/${route.search}`
      });
      response.end();

      return;
    }

    request.url = `/${route.file}${route.search}`;
    serve(request, response);
  };
}

export function editorPagesPlugin(
  editors: readonly EditorPackage[]
): Plugin[] {
  let outDir: string;

  return [
    {
      name: "studio-editor-pages",
      resolveId(id) {
        return id === EDITORS_MODULE_ID ? kResolvedEditorsModuleId : null;
      },
      load(id) {
        return id === kResolvedEditorsModuleId ? editorsModule(editors) : null;
      },
      configureServer(server) {
        server.middlewares.use(createEditorPagesHandler(editors));
      }
    },
    {
      name: "studio-editor-pages-copy",
      apply: "build",
      configResolved(config) {
        outDir = path.resolve(config.root, config.build.outDir);
      },
      async closeBundle() {
        await Promise.all(
          editors.map((editor) => fs.cp(
            editor.dist,
            path.join(outDir, EDITOR_PAGES_DIR, editor.name),
            { recursive: true }
          ))
        );
      }
    }
  ];
}

function parseRoute(
  request: IncomingMessage
): PageRoute | null {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith(EDITOR_PAGES_PREFIX)) {
    return null;
  }

  const remaining = url.pathname.slice(EDITOR_PAGES_PREFIX.length);
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
