// Import Internal Dependencies
import {
  resolveFocusHintPlacement,
  type FocusHintPosition
} from "./resolveFocusHintPlacement.ts";

// CONSTANTS
const kDefaultPosition = "top-center";
const kDefaultInset = 12;
const kDefaultText = "Click to focus";

export interface FocusHintOptions {
  position?: FocusHintPosition;
  inset?: number;
  text?: string;
}

export interface MountedFocusHint {
  dispose(): void;
}

export function mountFocusHint(
  canvas: HTMLCanvasElement,
  options: FocusHintOptions = {}
): MountedFocusHint {
  const {
    position = kDefaultPosition,
    inset = kDefaultInset,
    text = kDefaultText
  } = options;

  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.textContent = text;
  Object.assign(element.style, {
    position: "fixed",
    zIndex: "2147483000",
    pointerEvents: "none",
    padding: "6px 12px",
    borderRadius: "6px",
    background: "rgba(0, 0, 0, 0.55)",
    color: "#ffffff",
    font: "500 13px/1.2 system-ui, sans-serif",
    whiteSpace: "nowrap",
    opacity: "0",
    transition: "opacity 0.2s ease-in-out"
  });
  document.body.append(element);

  function updatePlacement(): void {
    const rect = canvas.getBoundingClientRect();
    const placement = resolveFocusHintPlacement(
      position,
      rect,
      {
        width: element.offsetWidth,
        height: element.offsetHeight
      },
      inset
    );

    element.style.left = `${placement.x}px`;
    element.style.top = `${placement.y}px`;
  }

  function updateVisibility(): void {
    const focused = document.activeElement === canvas;

    element.hidden = focused;
    element.style.opacity = focused ? "0" : "1";
    if (!focused) {
      updatePlacement();
    }
  }

  const view = document.defaultView;
  canvas.addEventListener("focus", updateVisibility);
  canvas.addEventListener("blur", updateVisibility);
  view?.addEventListener("resize", updatePlacement);
  view?.addEventListener("scroll", updatePlacement, true);

  const observer = typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver(() => updatePlacement());
  observer?.observe(canvas);

  updateVisibility();

  return {
    dispose() {
      canvas.removeEventListener("focus", updateVisibility);
      canvas.removeEventListener("blur", updateVisibility);
      view?.removeEventListener("resize", updatePlacement);
      view?.removeEventListener("scroll", updatePlacement, true);
      observer?.disconnect();
      element.remove();
    }
  };
}
