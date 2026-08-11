declare global {
  interface Window {
    /** Set once the first example has mounted. E2e tests gate on it. */
    __galleryReady?: boolean;
    /** Ids whose teardown ran, in order. */
    __galleryDisposed?: string[];
    /** Committed values collected by the end to end tier, which is the only tier that sees one. */
    __changes?: unknown[];
    /** Count of continuous `jolly-input` events, for asserting each control's cadence. */
    __inputs?: number;
  }
}

export interface GalleryExample {
  /**
   * Also the deep link: `/?example=<id>`.
   */
  id: string;
  title: string;
  group: string;
  /**
   * Returns its teardown. The gallery only clears the host, so release timers and listeners here.
   */
  render(
    host: HTMLElement
  ): (() => void) | void;
}
