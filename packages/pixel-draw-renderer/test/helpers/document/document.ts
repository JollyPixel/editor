// Import Internal Dependencies
import type { PixelDocument } from "#src/PixelDocument.ts";
import { HistoryDocument } from "./HistoryDocument.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";

export function createDocument(
  events: PixelCommand[] = []
): HistoryDocument {
  const doc = new HistoryDocument({
    size: {
      x: 4,
      y: 4
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
