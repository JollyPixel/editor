// CONSTANTS
const kDocumentEvents = [
  "keydown",
  "keyup",
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "wheel",
  "dragover",
  "dragleave",
  "drop"
] as const;
const kWindowEvents = [
  "resize",
  "focus",
  "blur"
] as const;

export class PageActivity {
  #abort = new AbortController();
  #onActivity: () => void;
  #resizeObserver: ResizeObserver | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    onActivity: () => void
  ) {
    this.#onActivity = onActivity;
    const document = canvas.ownerDocument;
    const view = document.defaultView;
    const options = {
      capture: true,
      passive: true,
      signal: this.#abort.signal
    };

    for (const type of kDocumentEvents) {
      document.addEventListener(
        type,
        onActivity,
        options
      );
    }
    if (view === null) {
      return;
    }

    for (const type of kWindowEvents) {
      view.addEventListener(
        type,
        onActivity,
        options
      );
    }
    this.#resizeObserver = new view.ResizeObserver(
      onActivity
    );
    this.#resizeObserver.observe(
      canvas.parentElement ?? canvas
    );
    this.#watchPixelRatio(view);
  }

  dispose(): void {
    this.#abort.abort();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
  }

  #watchPixelRatio(
    view: Window
  ): void {
    const { signal } = this.#abort;
    if (signal.aborted) {
      return;
    }

    const query = view.matchMedia(
      `(resolution: ${view.devicePixelRatio}dppx)`
    );
    query.addEventListener(
      "change",
      () => {
        this.#onActivity();
        this.#watchPixelRatio(view);
      },
      {
        once: true,
        signal
      }
    );
  }
}
