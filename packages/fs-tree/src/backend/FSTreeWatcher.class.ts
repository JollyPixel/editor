// Import Node.js Dependencies
import { randomBytes } from "node:crypto";

// Import Third-party Dependencies
import chokidar, { type FSWatcher } from "chokidar";

// Import Internal Dependencies
import { FSTree } from "./FSTree.class.ts";
import type { FSTreeTag } from "./types.ts";

export class FSTreeWatcher {
  #watcher: FSWatcher;
  #tags = new Set<FSTreeTag>();

  constructor(
    tree: FSTree
  ) {
    this.#watcher = chokidar.watch(tree.root, {
      persistent: true,
      awaitWriteFinish: true
    });
    this.#watcher.once("ready", () => {
      this.#initializeWatcherListeners(tree);
    });
  }

  resolveTag(
    tag: FSTreeTag
  ): boolean {
    const hasTag = this.#tags.has(tag);
    if (hasTag) {
      this.#tags.delete(tag);
    }

    return hasTag;
  }

  #createTag(): string {
    const tag = randomBytes(8).toString("hex");
    this.#tags.add(tag);

    return tag;
  }

  #initializeWatcherListeners(
    tree: FSTree
  ): void {
    const parentPath = tree.root;
    function noop() {
      return void 0;
    }

    /**
     * Note: we ignore change because the goal is not to track file updates
     */
    this.#watcher
      .on("add", (name) => {
        tree
          .prevent(this.#createTag())
          .append({ parentPath, name });
      })
      .on("change", noop)
      .on("unlink", (name) => {
        tree
          .prevent(this.#createTag())
          .unlink({ parentPath, name });
      })
      .on("addDir", (dirPath) => {
        tree
          .prevent(this.#createTag())
          .mkdir(dirPath);
      })
      .on("unlinkDir", (dirPath) => {
        tree
          .prevent(this.#createTag())
          .rmdir(dirPath);
      });
  }

  async close(): Promise<void> {
    this.#watcher.removeAllListeners();
    this.#watcher.close();
  }
}
