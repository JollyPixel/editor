// Import Internal Dependencies
import { PixelDocument } from "#src/PixelDocument.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";

export function createDocument(
  events: PixelBufferHookEvent[] = []
): PixelDocument {
  return new PixelDocument({
    size: {
      x: 4,
      y: 4
    },
    history: {
      enabled: true
    },
    onBufferUpdated: (event) => events.push(event)
  });
}

export function pixelAt(
  doc: PixelDocument,
  x: number,
  y: number
): number[] {
  return [
    ...doc.buffer.samplePixel(x, y)
  ];
}
