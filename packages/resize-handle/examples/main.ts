// Import Internal Dependencies
import {
  CornerResizeHandle,
  ResizeHandle,
  type ResizeHandleLike
} from "../src/index.ts";
import "./main.css";

function requiredElement<TElement extends Element>(
  selector: string
): TElement {
  const element = document.querySelector<TElement>(selector);

  if (element === null) {
    throw new Error(`Missing demo element: ${selector}`);
  }

  return element;
}

const sidebar = requiredElement<HTMLElement>("#sidebar");
const output = requiredElement<HTMLElement>("#output");
const object = requiredElement<HTMLElement>("#object");
const objectHandleElt = requiredElement<HTMLElement>("#object-handle");
const status = requiredElement<HTMLOutputElement>("#status");

const sidebarHandle = new ResizeHandle(sidebar, {
  direction: "left",
  collapsible: true,
  minSize: 160,
  maxSize: 420
});
const outputHandle = new ResizeHandle(output, {
  direction: "bottom",
  collapsible: true,
  minSize: 100,
  maxSize: 320
});
// horizontal:"left"/vertical:"top" anchors the object's top-left corner, so
// the supplied handle (placed bottom-right in the markup) grows both axes
// together as it's dragged away from that anchor.
const objectCorner = new CornerResizeHandle(object, {
  horizontal: "left",
  vertical: "top",
  handle: objectHandleElt,
  minWidth: 60,
  maxWidth: 260,
  minHeight: 60,
  maxHeight: 220
});
const handles: ResizeHandleLike[] = [
  sidebarHandle,
  outputHandle,
  objectCorner
];

function visibleSize(
  element: HTMLElement,
  dimension: "height" | "width"
): number {
  if (element.style.display === "none") {
    return 0;
  }

  return Math.round(
    element.getBoundingClientRect()[dimension]
  );
}

function updateStatus() {
  const sidebarWidth = visibleSize(sidebar, "width");
  const outputHeight = visibleSize(output, "height");
  const objectWidth = visibleSize(object, "width");
  const objectHeight = visibleSize(object, "height");

  status.textContent = `Sidebar ${sidebarWidth}px · Output ${outputHeight}px · `
    + `Object ${objectWidth}x${objectHeight}px`;
}

for (const handle of handles) {
  handle.addEventListener(
    "drag",
    updateStatus
  );
  handle.addEventListener(
    "dragEnd",
    updateStatus
  );
}

// Only the edge handles are collapsible; the corner handle has no
// double-click behavior.
sidebarHandle.handleElt.addEventListener("dblclick", updateStatus);
outputHandle.handleElt.addEventListener("dblclick", updateStatus);

window.addEventListener("beforeunload", () => {
  for (const handle of handles) {
    handle.dispose();
  }
});

updateStatus();
