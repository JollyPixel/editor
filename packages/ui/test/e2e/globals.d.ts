declare global {
  interface Window {
    __events?: [string, unknown][];
    __galleryDisposed?: string[];
    __galleryReady?: boolean;
  }
}

export {};
