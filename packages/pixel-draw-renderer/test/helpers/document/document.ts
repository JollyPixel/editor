// Import Internal Dependencies
import { PixelDocument } from "#src/PixelDocument.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";

export function createDocument(
  events: PixelCommand[] = []
): PixelDocument {
  const doc = new PixelDocument({
    size: {
      x: 4,
      y: 4
    },
    history: {
      enabled: true
    }
  });
  doc.on("command", (command) => events.push(command));

  return doc;
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
