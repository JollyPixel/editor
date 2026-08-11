// Import Internal Dependencies
import { ResizeHandle } from "../src/index.ts";
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
const handles = [
  sidebarHandle,
  outputHandle
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

  status.textContent = `Sidebar ${sidebarWidth}px · Output ${outputHeight}px`;
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
  handle.handleElt.addEventListener(
    "dblclick",
    updateStatus
  );
}

window.addEventListener("beforeunload", () => {
  for (const handle of handles) {
    handle.dispose();
  }
});

updateStatus();
