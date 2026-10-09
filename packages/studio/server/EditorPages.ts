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
import type { Connect } from "vite";

// Import Internal Dependencies
import {
  EDITOR_PAGES_DIR,
  EDITOR_PAGES_PREFIX
} from "../src/editors/EditorDescriptor.ts";
import type { EditorPackage } from "./EditorPackage.ts";
import type { EditorPackages } from "./EditorPackages.ts";
import {
  EditorPagesWatcher,
  type EditorPagesServer
} from "./EditorPagesWatcher.ts";

// CONSTANTS
const kHashedAsset = /^assets\/.+-[\w-]{8}\.\w+$/;
const kImmutableCacheControl = "public, max-age=31536000, immutable";

export class EditorPages {
  readonly editors: readonly EditorPackage[];
  readonly middleware: Connect.NextHandleFunction;

  constructor(
    editors: EditorPackages
  ) {
    this.editors = [...editors];
    this.middleware = compose(
      ...this.editors.map((editor) => servo(editor.dist, {
        prefix: `${EDITOR_PAGES_PREFIX}${editor.name}`,
        dev: true,
        setHeaders: cacheHashedAssets
      })),
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
      this.editors.map((editor) => fs.cp(
        editor.dist,
        path.join(outDir, EDITOR_PAGES_DIR, editor.name),
        { recursive: true }
      ))
    );
  }
}

function cacheHashedAssets(
  response: ServerResponse,
  filePath: string
): void {
  if (kHashedAsset.test(filePath)) {
    response.setHeader(
      "Cache-Control",
      kImmutableCacheControl
    );
  }
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
