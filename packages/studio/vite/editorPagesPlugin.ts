// Import Node.js Dependencies
import fs from "node:fs/promises";
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
  EDITOR_PAGES_DIR,
  EDITOR_PAGES_PREFIX,
  type EditorDescriptor
} from "../src/editors/EditorDescriptor.ts";
import type { EditorPackage } from "./editorManifest.ts";

// CONSTANTS
export const EDITORS_MODULE_ID = "virtual:jolly-pixel/editors";
const kResolvedEditorsModuleId = `\0${EDITORS_MODULE_ID}`;

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
