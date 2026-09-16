// Import Node.js Dependencies
import { Buffer } from "node:buffer";

// Import Third-party Dependencies
import type { Locator } from "@playwright/test";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";
import { encodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import { TEXTURE_SIZE } from "./constants.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// CONSTANTS
export const BLACK = "#000000ff";
export const CLEAR = "#00000000";

const kModeLabel: Record<Mode, string> = {
  move: "Move",
  paint: "Paint",
  erase: "Erase",
  fill: "Fill",
  select: "Select",
  uv: "UV"
};

export interface TexturePoint {
  x: number;
  y: number;
}

export interface PixelRect extends TexturePoint {
  width?: number;
  height?: number;
  color: string;
}

export interface PngFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

type MouseButton = "left" | "right" | "middle";

export async function setMode(
  panel: Locator,
  mode: Mode
): Promise<void> {
  await panel.getByRole("button", {
    name: kModeLabel[mode],
    exact: true
  }).click();
}

export async function clickToolOption(
  panel: Locator,
  mode: Mode,
  option: string
): Promise<void> {
  await panel.page().mouse.move(0, 0);
  await panel.getByRole("button", {
    name: kModeLabel[mode],
    exact: true
  }).hover();
  await panel.getByRole("button", {
    name: option,
    exact: true
  }).click();
}

export async function setBrushSize(
  panel: Locator,
  size: number
): Promise<void> {
  await panel.locator(".tool-option-overlay input[type=range]")
    .fill(String(size));
}

export async function setBrushColor(
  panel: Locator,
  slot: "primary" | "secondary",
  hex: string
): Promise<void> {
  await panel.evaluate((element: PixelDrawPanel, args) => {
    element.canvasManager!.brush[args.slot].set(args.hex, 1);
  }, { slot, hex });
}

export function readBrush(
  panel: Locator
): Promise<{ primary: string; secondary: string; }> {
  return panel.evaluate((element: PixelDrawPanel) => {
    const { brush } = element.canvasManager!;

    return {
      primary: brush.primary.asString("hex").toLowerCase(),
      secondary: brush.secondary.asString("hex").toLowerCase()
    };
  });
}

export function activeMode(
  panel: Locator
): Promise<Mode> {
  return panel.evaluate(
    (element: PixelDrawPanel) => element.canvasManager!.mode
  );
}

export async function seedTexture(
  panel: Locator,
  rects: PixelRect[]
): Promise<void> {
  await panel.evaluate((element: PixelDrawPanel, args) => {
    const canvas = element.canvasManager!;
    const source = document.createElement("canvas");
    source.width = args.size.x;
    source.height = args.size.y;
    const context = source.getContext("2d")!;
    for (const rect of args.rects) {
      context.fillStyle = rect.color;
      context.fillRect(
        rect.x,
        rect.y,
        rect.width ?? 1,
        rect.height ?? 1
      );
    }
    canvas.texture = source;
    canvas.document.history.clear();
  }, {
    rects,
    size: TEXTURE_SIZE
  });
}

export function addUvRegion(
  panel: Locator,
  rect: { x: number; y: number; width: number; height: number; }
): Promise<void> {
  return panel.evaluate((element: PixelDrawPanel, regionRect) => {
    element.canvasManager!.uv.restore({
      id: "e2e-region",
      color: "#00ffff",
      state: "stacked",
      rect: regionRect
    });
  }, rect);
}

export function readPixels(
  panel: Locator,
  points: TexturePoint[]
): Promise<string[]> {
  return panel.evaluate((element: PixelDrawPanel, targets) => {
    const texture = element.canvasManager!.textureCanvas();
    const context = texture.getContext("2d")!;

    return targets.map(({ x, y }) => {
      const rgba = context.getImageData(x, y, 1, 1).data;

      return `#${Array.from(rgba, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    });
  }, points);
}

export function readRenderedPixels(
  panel: Locator,
  points: TexturePoint[]
): Promise<string[]> {
  return panel.evaluate((element: PixelDrawPanel, targets) => {
    const canvasManager = element.canvasManager!;
    const canvas = canvasManager.canvas();
    const bounds = canvas.getBoundingClientRect();
    const { camera, zoom } = canvasManager.viewport;
    const context = canvas.getContext("2d")!;

    return targets.map(({ x, y }) => {
      const rgba = context.getImageData(
        Math.floor((camera.x + ((x + 0.5) * zoom.value)) * canvas.width / bounds.width),
        Math.floor((camera.y + ((y + 0.5) * zoom.value)) * canvas.height / bounds.height),
        1,
        1
      ).data;

      return `#${Array.from(rgba, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    });
  }, points);
}

export function textureToScreenPoint(
  panel: Locator,
  point: TexturePoint
): Promise<TexturePoint> {
  return panel.evaluate((element: PixelDrawPanel, { x, y }) => {
    const canvasManager = element.canvasManager!;
    const bounds = canvasManager.canvas().getBoundingClientRect();
    const { camera, zoom } = canvasManager.viewport;

    return {
      x: bounds.left + camera.x + ((x + 0.5) * zoom.value),
      y: bounds.top + camera.y + ((y + 0.5) * zoom.value)
    };
  }, point);
}

export async function dragStroke(
  panel: Locator,
  points: TexturePoint[],
  options: { button?: MouseButton; steps?: number; } = {}
): Promise<void> {
  const {
    button = "left",
    steps = 4
  } = options;
  const { mouse } = panel.page();
  const screenPoints = await Promise.all(
    points.map((point) => textureToScreenPoint(panel, point))
  );

  await mouse.move(screenPoints[0].x, screenPoints[0].y);
  await mouse.down({ button });
  for (let i = 1; i < points.length; i++) {
    const distance = Math.max(
      Math.abs(points[i].x - points[i - 1].x),
      Math.abs(points[i].y - points[i - 1].y)
    );
    await mouse.move(screenPoints[i].x, screenPoints[i].y, {
      steps: Math.max(1, distance * steps)
    });
  }
  await mouse.up({ button });
}

export async function clickTexturePixel(
  panel: Locator,
  point: TexturePoint,
  button: MouseButton = "left"
): Promise<void> {
  await dragStroke(panel, [point], { button });
}

export async function hoverTexturePixel(
  panel: Locator,
  point: TexturePoint
): Promise<void> {
  const screen = await textureToScreenPoint(panel, point);
  await panel.page().mouse.move(screen.x, screen.y);
}

export async function pngFile(
  name: string,
  size: { x: number; y: number; },
  rects: PixelRect[] = []
): Promise<PngFile> {
  const data = new Uint8ClampedArray(size.x * size.y * 4);
  for (const rect of rects) {
    const rgba = Buffer.from(rect.color.slice(1).padEnd(8, "f"), "hex");
    for (let y = rect.y; y < rect.y + (rect.height ?? 1); y++) {
      for (let x = rect.x; x < rect.x + (rect.width ?? 1); x++) {
        data.set(rgba, ((y * size.x) + x) * 4);
      }
    }
  }
  const png = await encodePng({
    width: size.x,
    height: size.y,
    data
  });

  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(png)
  };
}

export async function importFile(
  panel: Locator,
  file: PngFile
): Promise<void> {
  await panel.locator(".file-input").setInputFiles(file);
}

export async function dragFileOver(
  panel: Locator,
  point: TexturePoint
): Promise<void> {
  const screen = await textureToScreenPoint(panel, point);
  await panel.evaluate((element: PixelDrawPanel, { x, y }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([], "over.png", { type: "image/png" }));
    element.shadowRoot!.querySelector(".stage")!.dispatchEvent(
      new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        dataTransfer: transfer
      })
    );
  }, screen);
}

export async function dropFile(
  panel: Locator,
  point: TexturePoint,
  file: PngFile
): Promise<void> {
  const stage = panel.locator(".stage");
  const [screen, box] = await Promise.all([
    textureToScreenPoint(panel, point),
    stage.boundingBox()
  ]);
  await stage.drop({ files: file }, {
    position: {
      x: screen.x - box!.x,
      y: screen.y - box!.y
    }
  });
}
