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

export function watchPageActivity(
  canvas: HTMLCanvasElement,
  onActivity: () => void,
  signal: AbortSignal
): void {
  const document = canvas.ownerDocument;
  const view = document.defaultView;
  const options = {
    capture: true,
    passive: true,
    signal
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
  const resizeObserver = new view.ResizeObserver(onActivity);
  resizeObserver.observe(canvas.parentElement ?? canvas);
  signal.addEventListener(
    "abort",
    () => resizeObserver.disconnect(),
    { once: true }
  );
  watchPixelRatio(view, onActivity, signal);
}

function watchPixelRatio(
  view: Window,
  onActivity: () => void,
  signal: AbortSignal
): void {
  if (signal.aborted) {
    return;
  }

  const query = view.matchMedia(
    `(resolution: ${view.devicePixelRatio}dppx)`
  );
  query.addEventListener(
    "change",
    () => {
      onActivity();
      watchPixelRatio(view, onActivity, signal);
    },
    {
      once: true,
      signal
    }
  );
}
