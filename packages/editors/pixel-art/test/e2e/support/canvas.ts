// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import type { PngFile } from "./files.ts";
import type { PixelDrawPanel } from "../../../src/index.ts";

// CONSTANTS
export const BLACK = "#000000ff";
export const CLEAR = "#00000000";
export const TEXTURE_SIZE = {
  x: 80,
  y: 80
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

export type MouseButton = "left" | "right" | "middle";

export interface DragOptions {
  button?: MouseButton;
  steps?: number;
}

export class TextureCanvas {
  readonly host: Locator;
  readonly stage: Locator;
  readonly #panel: Locator;

  constructor(
    panel: Locator
  ) {
    this.#panel = panel;
    this.host = panel.locator("[part~='canvas-host']");
    this.stage = panel.locator(".stage");
  }

  screenPoint(
    point: TexturePoint
  ): Promise<TexturePoint> {
    return this.#panel.evaluate((element: PixelDrawPanel, target) => {
      const canvasManager = element.canvasManager!;

      return canvasManager.viewport.textureClientPosition(
        target,
        canvasManager.canvas().getBoundingClientRect()
      );
    }, point);
  }

  async drag(
    points: TexturePoint[],
    options: DragOptions = {}
  ): Promise<void> {
    const {
      button = "left",
      steps = 4
    } = options;
    const { mouse } = this.#panel.page();
    const screenPoints = await Promise.all(
      points.map((point) => this.screenPoint(point))
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

  async click(
    point: TexturePoint,
    button: MouseButton = "left"
  ): Promise<void> {
    await this.drag([point], { button });
  }

  async hover(
    point: TexturePoint
  ): Promise<void> {
    const screen = await this.screenPoint(point);
    await this.#panel.page().mouse.move(screen.x, screen.y);
  }

  async seed(
    rects: PixelRect[]
  ): Promise<void> {
    await this.#panel.evaluate((element: PixelDrawPanel, args) => {
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
      canvas.document.runLocalRestore(() => {
        canvas.texture = source;
      });
    }, {
      rects,
      size: TEXTURE_SIZE
    });
  }

  pixels(
    points: TexturePoint[]
  ): Promise<string[]> {
    return this.#panel.evaluate((element: PixelDrawPanel, targets) => {
      const { buffer } = element.canvasManager!.document;

      return buffer.samplePixels(targets).map(({ r, g, b, a }) => {
        const bytes = [r, g, b, a];

        return `#${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      });
    }, points);
  }

  renderedPixels(
    points: TexturePoint[]
  ): Promise<string[]> {
    return this.#panel.evaluate((element: PixelDrawPanel, targets) => {
      const canvasManager = element.canvasManager!;
      const canvas = canvasManager.canvas();
      const bounds = canvas.getBoundingClientRect();
      const context = canvas.getContext("2d")!;

      return targets.map((target) => {
        const client = canvasManager.viewport.textureClientPosition(target, bounds);
        const rgba = context.getImageData(
          Math.floor((client.x - bounds.left) * canvas.width / bounds.width),
          Math.floor((client.y - bounds.top) * canvas.height / bounds.height),
          1,
          1
        ).data;

        return `#${Array.from(rgba, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      });
    }, points);
  }

  size(): Promise<TexturePoint> {
    return this.#panel.evaluate(
      (element: PixelDrawPanel) => element.canvasManager!.textureSize
    );
  }

  async dragFileOver(
    point: TexturePoint
  ): Promise<void> {
    const screen = await this.screenPoint(point);
    await this.#panel.evaluate((element: PixelDrawPanel, { x, y }) => {
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

  async drop(
    point: TexturePoint,
    file: PngFile
  ): Promise<void> {
    const [screen, box] = await Promise.all([
      this.screenPoint(point),
      this.stage.boundingBox()
    ]);
    await this.stage.drop({ files: file }, {
      position: {
        x: screen.x - box!.x,
        y: screen.y - box!.y
      }
    });
  }
}
