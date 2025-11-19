// Import Internal Dependencies
import CanvasManager, { Mode } from "./CanvasManager.ts";
import ThreeSceneManager from "./threeScene.ts";

// CONSTANTS
const kContainer = document.getElementById("container") as HTMLDivElement;
const kColorPicker = document.getElementById("colorPicker") as HTMLInputElement;
const kBrushSize = document.getElementById("brushSize") as HTMLInputElement;
const kSection = document.querySelector("section") as HTMLDivElement;

const canvasManager = new CanvasManager(kContainer, {
  texture: {
    size: { x: 16 }
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

const threeSceneManager = new ThreeSceneManager(kSection, canvasManager);

kColorPicker.addEventListener("input", () => {
  const selectedColor = kColorPicker.value;
  canvasManager.brush.setColor(selectedColor);
  kColorPicker.value = selectedColor;
});
kBrushSize.value = String(canvasManager.brush.getSize());
kBrushSize.addEventListener("input", () => {
  const brushSize = kBrushSize.value;
  canvasManager.brush.setSize(Number(brushSize));
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

  threeSceneManager.onResize();
  canvasManager.onResize();
});

document.addEventListener("mouseup", () => {
  isResizing = false;
  document.body.style.cursor = "default";
});

