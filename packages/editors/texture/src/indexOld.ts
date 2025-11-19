const canvas = document.getElementById("textureCanvas") as HTMLCanvasElement;
const container = document.getElementById("container")!;
const ctx = canvas.getContext("2d")!;
const svg = document.getElementById("uvOverlay")!;
// const uvRect = document.getElementById("uvRect");

const gridSize = 32;
const uvSize = 8;
let zoom = 16;
const zoomMin = 1;
const zoomMax = 20;

interface UVInformation {
  x: number;
  y: number;
  width: number;
  height: number;
  hidden: boolean;
  element?: SVGRectElement;
}

let selectedColor = "black";
let hoverX: number | null = null;
let hoverY: number | null = null;

// let panX = 0;
// let panY = 0;
// let isPanning = false;
// let startPanX = 0;
// let startPanY = 0;

const uvRects = [
  { x: 4, y: 4, width: uvSize, height: uvSize, hidden: false },
  { x: 12, y: 12, width: uvSize, height: uvSize, hidden: false },
  { x: 12, y: 12, width: uvSize / 2, height: uvSize / 2, hidden: false }
];
let selectedRect: null | UVInformation = null; // uvRects[0]; // Default selected

const texture = Array(gridSize).fill().map(() => Array(gridSize).fill("white"));

function isMouseInCanvasHTMLElement(canvas: HTMLCanvasElement, mouseX: number, mouseY: number) {
  const rect = canvas.getBoundingClientRect();

  return mouseX >= rect.left && mouseX <= rect.right &&
    mouseY >= rect.top && mouseY <= rect.bottom;
}

// function syncSVGToCanvas() {
//     const rect = canvas.getBoundingClientRect();
//     svg.style.width = rect.width + 'px';
//     svg.style.height = rect.height + 'px';
//     svg.setAttribute('width', rect.width);
//     svg.setAttribute('height', rect.height);
// }

// function initUVRects(uvRects: UVInformation[]) {
//   for (const rect of uvRects) {
//     const rectElem = document.createElementNS("http://www.w3.org/2000/svg", "rect");
//     rectElem.classList.add("uv");
//     svg.appendChild(rectElem);
//     rect.element = rectElem;
//     rect.element.style.display = rect.hidden ? "none" : "";
//     rect.element.style.pointerEvents = "none";

//     updateUVRect(rect);
//   }
// }

function updateUVRect(rect: UVInformation) {
  if (rect.hidden) {
    rect.element!.style.display = "none";

    return;
  }

  rect.element!.style.display = "";

  const x = rect.x * zoom;
  const y = rect.y * zoom;
  const width = rect.width * zoom;
  const height = rect.height * zoom;
  rect.element!.setAttribute("x", String(x));
  rect.element!.setAttribute("y", String(y));
  rect.element!.setAttribute("width", String(width));
  rect.element!.setAttribute("height", String(height));
}

function updateAllUVRects() {
  for (const rect of uvRects) {
    updateUVRect(rect);
  }
}

function drawTexture() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      ctx.fillStyle = texture[y][x];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // if (mode === "paint" && hoverX !== null && hoverY !== null) {
  //   drawHighlight(hoverX, hoverY);
  // }
}

function drawHighlight(x: number, y: number) {
  // need to clean previous highlight
  drawTexture();
  if (mode === "paint" && x !== null && y !== null) {
    ctx.fillStyle = "rgba(128, 128, 128, 0.3)";
    ctx.fillRect(x, y, 1, 1);
  }
}

canvas.addEventListener("mouseleave", () => {
  hoverX = null;
  hoverY = null;
  drawTexture();
});

let isPainting = false;

canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  if (mode !== "paint" || e.button !== 0) {
    return;
  }
  isPainting = true;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / zoom);
  const y = Math.floor((e.clientY - rect.top) / zoom);
  if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
    texture[y][x] = selectedColor;
    // drawTexture();
  }
});

canvas.addEventListener("mousemove", (e) => {
  e.preventDefault();
  if (mode !== "paint") {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / zoom);
  const y = Math.floor((e.clientY - rect.top) / zoom);

  // Met à jour le highlight même si on ne peint pas
  hoverX = (x >= 0 && x < gridSize) ? x : null;
  hoverY = (y >= 0 && y < gridSize) ? y : null;

  // Si on peint, on colorie aussi
  if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
    drawHighlight(x, y);
    if (isPainting && e.buttons === 1) {
      texture[y][x] = selectedColor;
    }
  }
});

window.addEventListener("mouseup", (e) => {
  e.preventDefault();
  isPainting = false;
});

canvas.addEventListener("click", (e) => {
  e.preventDefault();
  if (mode !== "paint" || e.button !== 0) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left));
  const y = Math.floor((e.clientY - rect.top));
  if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
    texture[y][x] = selectedColor;
    drawTexture();
  }
});

// Empêche le menu contextuel par défaut sur le canvas
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (mode !== "paint") {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / zoom);
  const y = Math.floor((e.clientY - rect.top) / zoom);
  if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
    const pickedColor = texture[y][x];
    selectedColor = pickedColor;
    colorPicker.value = pickedColor;
    lastColorDiv.style.background = pickedColor;
  }
});

container.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = Math.sign(e.deltaY);
  zoom = Math.max(zoomMin, Math.min(zoomMax, zoom - delta));
  // updateAllUVRects();
  drawTexture();
  // syncSVGToCanvas();
});

function getUVRectsUnderMouse(mouseX: number, mouseY: number): UVInformation[] {
  // Parcours du plus haut au plus bas
  const under: UVInformation[] = [];
  for (let i = uvRects.length - 1; i >= 0; i--) {
    const rect = uvRects[i];
    const x = rect.x * zoom;
    const y = rect.y * zoom;
    const w = rect.width * zoom;
    const h = rect.height * zoom;
    if (
      mouseX >= x && mouseX <= x + w &&
      mouseY >= y && mouseY <= y + h
    ) {
      under.push(rect);
    }
  }

  return under;
}

let wantToDrag = false;
let isDragging = false;
let offsetX: number = 0;
let offsetY: number = 0;

// svg.addEventListener("mousedown", (e) => {
//   e.preventDefault();
//   if (mode !== "move") {
//     return;
//   }
//   const svgRect = svg.getBoundingClientRect();
//   const mouseX = e.clientX - svgRect.left;
//   const mouseY = e.clientY - svgRect.top;
//   const under = getUVRectsUnderMouse(mouseX, mouseY);

//   if (under.length > 0 && selectedRect && under.includes(selectedRect)) {
//     wantToDrag = true;
//     isDragging = false;
//     offsetX = mouseX - (selectedRect.x * zoom);
//     offsetY = mouseY - (selectedRect.y * zoom);
//   }
//   else {
//     wantToDrag = false;
//     isDragging = false;
//   }
// });

// svg.addEventListener("mousemove", (e) => {
//   e.preventDefault();
//   if (!wantToDrag || mode !== "move" || !selectedRect) {
//     return;
//   }
//   isDragging = true;
//   const containerRect = canvas.getBoundingClientRect();
//   const x = Math.floor((e.clientX - containerRect.left - offsetX) / zoom);
//   const y = Math.floor((e.clientY - containerRect.top - offsetY) / zoom);

//   selectedRect.x = x;
//   selectedRect.y = y;
//   updateUVRect(selectedRect);
// });

// window.addEventListener("mouseup", (e) => {
//   if (mode !== "move") {
//     return;
//   }

//   const svgRect = svg.getBoundingClientRect();
//   const mouseX = e.clientX - svgRect.left;
//   const mouseY = e.clientY - svgRect.top;
//   const under = getUVRectsUnderMouse(mouseX, mouseY);

//   if (wantToDrag && isDragging) {
//     // Drag terminé, ne pas cycler la sélection
//     wantToDrag = false;
//     isDragging = false;

//     return;
//   }

//   wantToDrag = false;
//   isDragging = false;

//   // Cyclage de la sélection si pas de drag effectif
//   if (under.length > 0) {
//     const idx = under.indexOf(selectedRect!);
//     const nextRect = (idx === -1) ? under[0] : under[(idx + 1) % under.length];
//     if (selectedRect) {
//       selectedRect.element!.classList.remove("selectedUv");
//     }
//     selectedRect = nextRect;
//     selectedRect.element!.classList.add("selectedUv");
//   }
//   else {
//     if (selectedRect) {
//       selectedRect.element!.classList.remove("selectedUv");
//     }
//     selectedRect = null;
//   }
// });

document.querySelectorAll<HTMLInputElement>(".color-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".color-button").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedColor = btn.dataset.color!;
  });
});

function updateMode(newMode: string) {
  mode = newMode;
  if (mode === "paint") {
    svg.style.pointerEvents = "none";
  }
  else {
    svg.style.pointerEvents = "auto";
    hoverX = null;
    hoverY = null;
  }

  // Mise à jour visuelle des boutons
  document.getElementById("paintMode")!.classList.toggle("mode-active", mode === "paint");
  document.getElementById("moveMode")!.classList.toggle("mode-active", mode === "move");
}

document.getElementById("paintMode")!.addEventListener("click", () => updateMode("paint"));
document.getElementById("moveMode")!.addEventListener("click", () => updateMode("move"));

// Initialisation de la couleur sélectionnée et de la div d'affichage
const colorPicker = document.getElementById("colorPicker")! as HTMLInputElement;
const lastColorDiv = document.getElementById("lastColor")!;
selectedColor = colorPicker.value;
lastColorDiv.style.background = selectedColor;

// Quand on change la couleur dans la palette
colorPicker.addEventListener("input", () => {
  selectedColor = colorPicker.value;
  lastColorDiv.style.background = selectedColor;
});

drawTexture();
// syncSVGToCanvas();

// initUVRects(uvRects);
updateMode("paint");

// window.addEventListener('resize', syncSVGToCanvas);
