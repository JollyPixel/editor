// CONSTANTS
const kTrackedAttr = "data-jolly-modality-tracked";

declare global {
  interface Window {
    __jollyLastInputWasPointer?: boolean;
  }
}

export function ensureModalityTracking(): void {
  if (
    typeof document === "undefined" ||
    document.documentElement.hasAttribute(kTrackedAttr)
  ) {
    return;
  }

  document.documentElement.setAttribute(kTrackedAttr, "");

  window.addEventListener(
    "pointerdown",
    () => {
      window.__jollyLastInputWasPointer = true;
    },
    { capture: true }
  );
  window.addEventListener(
    "keydown",
    () => {
      window.__jollyLastInputWasPointer = false;
    },
    { capture: true }
  );
}

export function wasPointerInput(): boolean {
  return typeof window !== "undefined" &&
    window.__jollyLastInputWasPointer === true;
}
