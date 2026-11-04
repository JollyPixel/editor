// Import Third-party Dependencies
import type {
  ScriptDocument,
  ScriptOutlineFeed
} from "@jolly-pixel/asset.script/client";

// CONSTANTS
export const OUTLINE_REFRESH_DELAY = 800;

export class OutlineRefresh {
  #feed: ScriptOutlineFeed;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #release: () => void;

  constructor(
    document: ScriptDocument,
    feed: ScriptOutlineFeed
  ) {
    this.#feed = feed;
    this.#release = document.subscribe("change", ({ origin }) => {
      if (origin === "input" || origin === "history") {
        this.#schedule();
      }
    });
  }

  dispose(): void {
    this.#release();
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  #schedule(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
    }
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#feed.request();
    }, OUTLINE_REFRESH_DELAY);
  }
}
