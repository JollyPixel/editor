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

export interface GalleryEntry {
  /**
   * Also the deep link: `/?example=<id>`.
   */
  id: GalleryExampleId;
  title: string;
  load(): Promise<GalleryExample>;
}

export interface GalleryExample<
  TKey extends string = string
> {
  options?: readonly GalleryOption<TKey>[];
  render(
    host: HTMLElement,
    options: GalleryOptionValues<TKey>
  ): (() => void) | void;
}
