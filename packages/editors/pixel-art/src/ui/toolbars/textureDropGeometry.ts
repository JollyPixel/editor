// Import Third-party Dependencies
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kSupportedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);
const kSupportedExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif"
]);

export interface TextureDropBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FileSystemEntryLike {
  isDirectory: boolean;
}

export function isDirectoryItem(
  item: DataTransferItem
): boolean {
  const itemWithEntry = item as DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemEntryLike | null;
  };

  return itemWithEntry.webkitGetAsEntry?.()?.isDirectory === true;
}

export function isSupportedFile(
  file: File
): boolean {
  if (kSupportedTypes.has(file.type.toLowerCase())) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  return file.type === "" && extension !== undefined && kSupportedExtensions.has(extension);
}

export function hasSupportedImageDrag(
  dataTransfer: DataTransfer | null
): boolean {
  if (!dataTransfer || [...dataTransfer.types].includes("text/uri-list")) {
    return false;
  }

  const fileItems = [...dataTransfer.items].filter((item) => item.kind === "file");
  if (fileItems.length > 0) {
    return fileItems.length === 1 &&
      !isDirectoryItem(fileItems[0]) &&
      kSupportedTypes.has(fileItems[0].type.toLowerCase());
  }

  return dataTransfer.files.length === 1 &&
    isSupportedFile(dataTransfer.files[0]);
}

export function textureDropBounds(
  canvas: PixelArtCanvas,
  stage: HTMLElement
): TextureDropBounds {
  const canvasBounds = canvas.canvas().getBoundingClientRect();
  const stageBounds = stage.getBoundingClientRect();
  const { camera, zoom, textureSize } = canvas;

  return {
    left: canvasBounds.left - stageBounds.left + camera.x,
    top: canvasBounds.top - stageBounds.top + camera.y,
    width: textureSize.x * zoom.value,
    height: textureSize.y * zoom.value
  };
}

export function pointInTextureBounds(
  clientX: number,
  clientY: number,
  bounds: TextureDropBounds,
  stage: HTMLElement
): boolean {
  const stageBounds = stage.getBoundingClientRect();
  const x = clientX - stageBounds.left;
  const y = clientY - stageBounds.top;

  return x >= bounds.left &&
    x < bounds.left + bounds.width &&
    y >= bounds.top &&
    y < bounds.top + bounds.height;
}
