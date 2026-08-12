// CONSTANTS
const kTrackedAttr = "data-jolly-modality-tracked";

declare global {
  interface Window {
    __jollyLastInputWasPointer?: boolean;
  }
}

/**
 * Tracks global input modality independently of `:focus-visible`.
 */
export function ensureModalityTracking(): void {
  if (
    typeof document === "undefined" ||
    document.documentElement.hasAttribute(kTrackedAttr)
  ) {
    return;
  }

  document.documentElement.setAttribute(
    kTrackedAttr, ""
  );

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

/**
 * Whether the latest tracked input was a pointer event.
 */
export function wasPointerInput(): boolean {
  return typeof window !== "undefined" &&
    window.__jollyLastInputWasPointer === true;
}
