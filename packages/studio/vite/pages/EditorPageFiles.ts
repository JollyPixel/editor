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
import {
  EDITOR_PAGES_DIR,
  EDITOR_PAGES_PREFIX
} from "@jolly-pixel/server";
import {
  readPathname,
  serveBuild,
  type EditorPackage,
  type EditorPackages
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import {
  EditorPagesWatcher,
  type EditorPagesServer
} from "./EditorPagesWatcher.ts";

export class EditorPageFiles {
  readonly editors: readonly EditorPackage[];
  readonly middleware: ServoHandler;

  constructor(
    editors: EditorPackages
  ) {
    this.editors = [...editors];
    for (const editor of this.editors) {
      if (editor.page.kind === "prebuilt" && !existsSync(editor.dist)) {
        throw new TypeError(
          `"${editor.package}" has no built page at "${editor.dist}".`
        );
      }
    }
    this.middleware = compose(
      ...this.editors.flatMap((editor) => {
        const files = pageFiles(editor);

        return files === null ? [] : serveBuild(
          files,
          `${EDITOR_PAGES_PREFIX}${editor.name}`
        );
      }),
      unknownEditorPage
    );
  }

  watch(
    server: EditorPagesServer
  ): EditorPagesWatcher {
    return new EditorPagesWatcher(
      server,
      this.editors.filter((editor) => editor.page.kind === "built")
    );
  }

  async copyTo(
    outDir: string
  ): Promise<void> {
    await Promise.all(
      this.editors.flatMap((editor) => {
        const files = pageFiles(editor);

        return files === null ? [] : fs.cp(
          files,
          path.join(outDir, EDITOR_PAGES_DIR, editor.name),
          { recursive: true }
        );
      })
    );
  }
}

function pageFiles(
  editor: EditorPackage
): string | null {
  if (editor.page.kind !== "source") {
    return editor.dist;
  }
  const publicDir = path.join(path.dirname(editor.page.html), "public");

  return existsSync(publicDir) ? publicDir : null;
}

function unknownEditorPage(
  request: IncomingMessage,
  response: ServerResponse,
  next?: () => void
): void {
  const pathname = readPathname(request);

  if (
    pathname !== null &&
    pathname.startsWith(EDITOR_PAGES_PREFIX) &&
    pathname.length > EDITOR_PAGES_PREFIX.length
  ) {
    response.statusCode = 404;
    response.end();

    return;
  }

  next?.();
}
