// Import Node.js Dependencies
import fs from "node:fs/promises";
import {
  mkdirSync,
  watch,
  type FSWatcher
} from "node:fs";
import path from "node:path";
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import {
  compose,
  servo
} from "@openally/servo";
import type {
  Connect,
  Plugin
} from "vite";

// Import Internal Dependencies
import {
  EDITOR_PAGE_REBUILT_EVENT,
  EDITOR_PAGES_DIR,
  EDITOR_PAGES_PREFIX,
  type EditorDescriptor,
  type EditorPageRebuilt
} from "../src/editors/EditorDescriptor.ts";
import type { EditorPackage } from "./editorManifest.ts";

// CONSTANTS
export const EDITORS_MODULE_ID = "virtual:jolly-pixel/editors";
export const EDITOR_PAGE_SETTLE_MS = 300;
const kResolvedEditorsModuleId = `\0${EDITORS_MODULE_ID}`;

export interface EditorPagesServer {
  config: {
    logger: {
      warn(message: string): void;
    };
  };
  ws: {
    send(
      event: string,
      payload: EditorPageRebuilt
    ): void;
  };
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
  return compose(
    ...Array.from(editors, (editor) => servo(editor.dist, {
      prefix: `${EDITOR_PAGES_PREFIX}${editor.name}`,
      dev: true
    })),
    unknownEditorPage
  );
}

export function watchEditorPages(
  server: EditorPagesServer,
  editors: readonly EditorPackage[]
): () => void {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const watchers: FSWatcher[] = editors.map((editor) => {
    mkdirSync(editor.dist, { recursive: true });

    return watch(editor.dist, { recursive: true }, () => {
      clearTimeout(pending.get(editor.name));
      pending.set(editor.name, setTimeout(() => {
        pending.delete(editor.name);
        server.ws.send(EDITOR_PAGE_REBUILT_EVENT, {
          name: editor.name
        });
      }, EDITOR_PAGE_SETTLE_MS));
    }).on("error", (error) => {
      server.config.logger.warn(
        `editor page watcher for ${editor.name} failed: ${error.message}`
      );
    });
  });

  return () => {
    for (const watcher of watchers) {
      watcher.close();
    }
    for (const timer of pending.values()) {
      clearTimeout(timer);
    }
    pending.clear();
  };
}

export function editorPagesPlugin(
  editors: readonly EditorPackage[]
): Plugin[] {
  let outDir: string;
  let unwatch: (() => void) | null = null;

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
        unwatch = watchEditorPages(server, editors);
      },
      buildEnd() {
        unwatch?.();
        unwatch = null;
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

function unknownEditorPage(
  request: IncomingMessage,
  response: ServerResponse,
  next?: () => void
): void {
  const pathname = URL.parse(
    request.url ?? "/",
    "http://localhost"
  )?.pathname ?? "/";

  if (
    (request.method === "GET" || request.method === "HEAD") &&
    pathname.startsWith(EDITOR_PAGES_PREFIX) &&
    pathname.length > EDITOR_PAGES_PREFIX.length
  ) {
    response.statusCode = 404;
    response.end();

    return;
  }

  next?.();
}
