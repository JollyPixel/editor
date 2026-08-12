declare global {
  interface Window {
    __changes?: unknown[];
    __galleryDisposed?: string[];
    __galleryReady?: boolean;
    __inputs?: number;
  }
}

export {};
