// Import Internal Dependencies
import type { GalleryExampleId } from "./groups.ts";

declare global {
  interface Window {
    /**
     * Set once the first example has mounted.
     * E2e tests gate on it.
     */
    __galleryReady?: boolean;
    /**
     * Ids whose teardown ran, in order.
     */
    __galleryDisposed?: string[];
    /**
     * Committed values collected by the end to end tier,
     * which is the only tier that sees one.
     */
    __changes?: unknown[];
    /**
     * Count of continuous `jolly-input` events,
     * for asserting each control's cadence.
     */
    __inputs?: number;
  }
}

export interface GalleryExample {
  /**
   * Also the deep link: `/?example=<id>`.
   */
  id: GalleryExampleId;
  title: string;
  /**
   * Returns a teardown only for state living outside `host`: timers, subscriptions, listeners on
   * `window` or `document`, and panes mounting themselves on `document.body`. The gallery clears
   * `host` on its own, so appended elements need no teardown.
   */
  render(
    host: HTMLElement
  ): (() => void) | void;
}
