// Import Node.js Dependencies
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import {
  compose,
  type ServoHandler
} from "@openally/servo";

// Import Internal Dependencies
import {
  EDITOR_PAGES_DIR,
  EDITOR_PAGES_PREFIX
} from "../../shared/EditorDescriptor.ts";
import { serveBuild } from "../serveBuild.ts";
import type { EditorPackage } from "./EditorPackage.ts";
import type { EditorPackages } from "./EditorPackages.ts";
import {
  EditorPagesWatcher,
  type EditorPagesServer
} from "./EditorPagesWatcher.ts";

export class EditorPages {
  readonly editors: readonly EditorPackage[];
  readonly middleware: ServoHandler;

  constructor(
    editors: EditorPackages
  ) {
    this.editors = [...editors];
    for (const editor of this.editors) {
      if (editor.prebuilt && !existsSync(editor.dist)) {
        throw new TypeError(
          `"${editor.package}" has no built page at "${editor.dist}".`
        );
      }
    }
    this.middleware = compose(
      ...this.editors.map((editor) => serveBuild(
        editor.dist,
        `${EDITOR_PAGES_PREFIX}${editor.name}`
      )),
      unknownEditorPage
    );
  }

  watch(
    server: EditorPagesServer
  ): EditorPagesWatcher {
    return new EditorPagesWatcher(
      server,
      this.editors.filter((editor) => !editor.prebuilt)
    );
  }

  async copyTo(
    outDir: string
  ): Promise<void> {
    await Promise.all(
      this.editors.flatMap((editor) => {
        const files = copiedFiles(editor);

        return files === null ? [] : fs.cp(
          files,
          path.join(outDir, EDITOR_PAGES_DIR, editor.name),
          { recursive: true }
        );
      })
    );
  }
}

function copiedFiles(
  editor: EditorPackage
): string | null {
  if (editor.page === null) {
    return editor.dist;
  }
  const publicDir = path.join(path.dirname(editor.page), "public");

  return existsSync(publicDir) ? publicDir : null;
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
