// Import Node.js Dependencies
import {
  mkdirSync,
  watch,
  type FSWatcher
} from "node:fs";

// Import Internal Dependencies
import {
  EDITOR_PAGE_REBUILT_EVENT,
  type EditorPageRebuilt
} from "../src/editors/EditorDescriptor.ts";
import { DistSnapshot } from "./DistSnapshot.ts";
import type { EditorPackage } from "./EditorPackage.ts";

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

export class EditorPagesWatcher {
  #server: EditorPagesServer;
  #pending = new Map<string, ReturnType<typeof setTimeout>>();
  #watchers: FSWatcher[];

  constructor(
    server: EditorPagesServer,
    editors: Iterable<EditorPackage>
  ) {
    this.#server = server;
    this.#watchers = Array.from(editors, (editor) => this.#watch(editor));
  }

  close(): void {
    for (const watcher of this.#watchers) {
      watcher.close();
    }
    for (const timer of this.#pending.values()) {
      clearTimeout(timer);
    }
    this.#pending.clear();
  }

  #watch(
    editor: EditorPackage
  ): FSWatcher {
    mkdirSync(editor.dist, { recursive: true });
    const snapshot = new DistSnapshot(editor.dist);

    return watch(editor.dist, { recursive: true }, (_event, filename) => {
      if (filename !== null && !snapshot.update(filename)) {
        return;
      }

      clearTimeout(this.#pending.get(editor.name));
      this.#pending.set(editor.name, setTimeout(() => {
        this.#pending.delete(editor.name);
        this.#server.ws.send(EDITOR_PAGE_REBUILT_EVENT, {
          name: editor.name
        });
      }, EDITOR_PAGE_SETTLE_MS));
    }).on("error", (error) => {
      this.#server.config.logger.warn(
        `editor page watcher for ${editor.name} failed: ${error.message}`
      );
    });
  }
}
