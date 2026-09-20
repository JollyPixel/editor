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

export interface GalleryOption<
  TKey extends string = string
> {
  key: TKey;
  label: string;
  initial?: boolean;
}

export type GalleryOptionValues<
  TKey extends string = string
> = Readonly<Record<TKey, boolean>>;

export interface GalleryExample<
  TKey extends string = string
> {
  /**
   * Also the deep link: `/?example=<id>`.
   */
  id: GalleryExampleId;
  title: string;
  options?: readonly GalleryOption<TKey>[];
  /**
   * Returns a teardown only for state living outside `host`: timers, subscriptions, listeners on
   * `window` or `document`, and panes mounting themselves on `document.body`. The gallery clears
   * `host` on its own, so appended elements need no teardown.
   */
  render(
    host: HTMLElement,
    options: GalleryOptionValues<TKey>
  ): (() => void) | void;
}
