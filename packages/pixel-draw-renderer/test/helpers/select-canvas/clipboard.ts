// Import Internal Dependencies
import type { ClipboardAdapter } from "#src/clipboard/types.ts";
import { mouseEvent } from "../events.ts";

function makeClipboardItem(
  data: Record<string, Blob>
): ClipboardItem {
  return {
    types: Object.keys(data),
    presentationStyle: "unspecified",
    getType: async(type: string) => data[type]
  };
}

export function makeRasterClipboard(): ClipboardAdapter {
  return {
    read: async() => [makeClipboardItem({
      "image/png": new Blob(
        ["png"],
        { type: "image/png" }
      )
    })],
    write: async() => undefined
  };
}

export async function withBitmapSource<T>(
  source: HTMLCanvasElement,
  run: () => Promise<T>
): Promise<T> {
  const previous = globalThis.createImageBitmap;
  const bitmap = Object.assign(source, {
    close: () => undefined
  });
  Object.assign(globalThis, {
    createImageBitmap: async() => bitmap
  });

  try {
    return await run();
  }
  finally {
    Object.assign(globalThis, {
      createImageBitmap: previous
    });
  }
}

export function canvasPlaceSelection(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): void {
  canvas.dispatchEvent(
    mouseEvent(
      "mousedown",
      clientX,
      clientY
    )
  );
  canvas.dispatchEvent(
    new MouseEvent(
      "mouseup",
      { bubbles: true }
    )
  );
}
