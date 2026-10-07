// Import Internal Dependencies
import type { PixelDocument } from "#src/PixelDocument.ts";
import { HistoryDocument } from "./HistoryDocument.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";

export function createNormalMapDocument(
  events: PixelCommand[] = []
): HistoryDocument {
  const doc = new HistoryDocument({
    size: {
      x: 8,
      y: 8
    }
  });
  doc.on("command", (command) => events.push(command));

  return doc;
}

export function addRegion(
  doc: PixelDocument,
  id: string
): void {
  doc.uv.restore({
    id,
    color: "#fff",
    state: "stacked",
    rect: {
      x: 0,
      y: 0,
      width: 2,
      height: 2
    }
  });
}

export function zoneIds(
  doc: PixelDocument
): string[] {
  return doc.normalMap?.zones.map(
    (zone) => zone.regionId
  ) ?? [];
}
