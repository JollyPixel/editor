// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import type { Point } from "./pointer.ts";

export interface Pixel {
  red: number;
  green: number;
  blue: number;
}

export async function pixelAt(
  page: Page,
  point: Point
): Promise<Pixel> {
  const png = await page.screenshot({
    clip: {
      x: point.x - 1,
      y: point.y - 1,
      width: 3,
      height: 3
    },
    scale: "css"
  });

  return page.evaluate(async(base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("No 2D context to read the screenshot.");
    }
    context.drawImage(bitmap, 0, 0);
    const [red, green, blue] = context.getImageData(1, 1, 1, 1).data;

    return {
      red,
      green,
      blue
    };
  }, png.toString("base64"));
}
