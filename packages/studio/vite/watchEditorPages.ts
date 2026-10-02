// Import Node.js Dependencies
import {
  mkdirSync,
  readdirSync,
  statSync,
  watch,
  type FSWatcher
} from "node:fs";
import path from "node:path";

// Import Internal Dependencies
import {
  EDITOR_PAGE_REBUILT_EVENT,
  type EditorPageRebuilt
} from "../src/editors/EditorDescriptor.ts";
import type { EditorPackage } from "./editorManifest.ts";

// CONSTANTS
export const EDITOR_PAGE_SETTLE_MS = 300;

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

export function watchEditorPages(
  server: EditorPagesServer,
  editors: readonly EditorPackage[]
): () => void {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const watchers: FSWatcher[] = editors.map((editor) => {
    mkdirSync(editor.dist, { recursive: true });
    const snapshot = new DistSnapshot(editor.dist);

    return watch(editor.dist, { recursive: true }, (_event, filename) => {
      if (filename !== null && !snapshot.update(filename)) {
        return;
      }

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

class DistSnapshot {
  #root: string;
  #entries = new Map<string, string>();

  constructor(
    root: string
  ) {
    this.#root = root;
    this.#record(root);
  }

  update(
    file: string
  ): boolean {
    const key = path.normalize(file);
    const stats = statSync(
      path.join(this.#root, key),
      { throwIfNoEntry: false }
    );
    if (stats === undefined) {
      return this.#entries.delete(key);
    }

    const previous = this.#entries.get(key);
    const fingerprint = stats.isDirectory() ?
      "directory" :
      `${stats.mtimeMs}:${stats.size}`;
    this.#entries.set(key, fingerprint);

    return previous !== fingerprint;
  }

  #record(
    directory: string
  ): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      this.update(path.relative(this.#root, file));
      if (entry.isDirectory()) {
        this.#record(file);
      }
    }
  }
}
