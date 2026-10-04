// Import Internal Dependencies
import { PixelDocument } from "#src/PixelDocument.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";

export function createNormalMapDocument(
  events: PixelBufferHookEvent[] = []
): PixelDocument {
  return new PixelDocument({
    size: {
      x: 8,
      y: 8
    },
    history: {
      enabled: true,
      limit: 50
    },
    onBufferUpdated: (event) => events.push(event)
  });
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
