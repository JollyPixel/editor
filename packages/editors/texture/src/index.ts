// Import Internal Dependencies
import CanvasManager, { Mode } from "./CanvasManager";
import "./threeScene.ts";

// CONSTANTS
const kContainer = document.getElementById("container") as HTMLDivElement;
const kColorPicker = document.getElementById("colorPicker") as HTMLInputElement;

const canvasManager = new CanvasManager(kContainer, {
  texture: {
    size: { x: 128, y: 64 }
  },
  zoom: {
    default: 1,
    sensitivity: 1
  },
  brush: {
    color: kColorPicker.value,
    size: 5,
    colorPickerHtmlElement: kColorPicker
  }
});

kColorPicker.addEventListener("input", () => {
  const selectedColor = kColorPicker.value;
  canvasManager.brush.setColor(selectedColor);
});

document.querySelectorAll<HTMLInputElement>(".color-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".color-button").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    // selectedColor = btn.dataset.color!;
  });
});

function updateMode(newMode: Mode) {
  canvasManager.setMode(newMode);
  if (newMode === "paint") {
    // svg.style.pointerEvents = "none";
  }
  else {
    // svg.style.pointerEvents = "auto";
    // hoverX = null;
    // hoverY = null;
  }

  document.getElementById("paintMode")!.classList.toggle("mode-active", canvasManager.getMode() === "paint");
  document.getElementById("moveMode")!.classList.toggle("mode-active", canvasManager.getMode() === "move");
}

document.getElementById("paintMode")!.addEventListener("click", () => updateMode("paint"));
document.getElementById("moveMode")!.addEventListener("click", () => updateMode("move"));

updateMode("paint");

const resizer = document.querySelector(".resizer")!;
const nav = document.querySelector("nav")!;

let isResizing = false;

resizer.addEventListener("mousedown", () => {
  isResizing = true;
  document.body.style.cursor = "col-resize";
});

document.addEventListener("mousemove", (e) => {
  if (!isResizing) {
    return;
  }
  const newWidth = e.clientX;
  nav.style.width = `${newWidth}px`;

  canvasManager.onResize();
});

document.addEventListener("mouseup", () => {
  isResizing = false;
  document.body.style.cursor = "default";
});

