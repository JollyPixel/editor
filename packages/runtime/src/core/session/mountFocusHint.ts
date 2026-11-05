// Import Internal Dependencies
import type { OverlayLayer } from "../overlay/OverlayLayer.ts";
import type { OverlayPosition } from "../overlay/resolveOverlayAnchor.ts";

// CONSTANTS
const kDefaultPosition = "top-center";
const kDefaultInset = 12;
const kDefaultText = "Click to focus";

export type FocusHintPosition = OverlayPosition;

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
  layer: OverlayLayer,
  options: FocusHintOptions = {}
): MountedFocusHint {
  const {
    position = kDefaultPosition,
    inset = kDefaultInset,
    text = kDefaultText
  } = options;

  const element = canvas.ownerDocument.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.textContent = text;
  Object.assign(element.style, {
    boxSizing: "border-box",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
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
  const mounted = layer.mount(element, {
    position,
    inset
  });

  function updateVisibility(): void {
    const focused = canvas.ownerDocument.activeElement === canvas;

    element.hidden = focused;
    element.style.opacity = focused ? "0" : "1";
  }

  canvas.addEventListener("focus", updateVisibility);
  canvas.addEventListener("blur", updateVisibility);
  updateVisibility();

  return {
    dispose() {
      canvas.removeEventListener("focus", updateVisibility);
      canvas.removeEventListener("blur", updateVisibility);
      mounted.dispose();
    }
  };
}
