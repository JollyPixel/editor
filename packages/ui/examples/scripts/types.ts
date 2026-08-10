declare global {
  interface Window {
    /** Set once the first example has mounted. E2e tests gate on it. */
    __galleryReady?: boolean;
    /** Ids whose teardown ran, in order. */
    __galleryDisposed?: string[];
  }
}

export interface GalleryExample {
  /** Also the deep link: `/?example=<id>`. */
  id: string;
  title: string;
  group: string;
  /** Returns its teardown. The gallery only clears the host, so release timers and listeners here. */
  render(host: HTMLElement): (() => void) | void;
}
