// Import Third-party Dependencies
import type { PixelArtCanvasOptions } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
export const DECODE_FAILED_MESSAGE = "Could not decode the image";

export type TextureImportPolicy = "replace" | "add" | "ask";

export type TextureImportOrigin = "import" | "drop";

export interface PixelDrawTextureOptions extends PixelArtCanvasOptions {
  id: string;
  name: string;
  tooltip?: string;
}

export interface PixelDrawInitializeOptions extends PixelArtCanvasOptions {
  id?: string;
  name?: string;
  tooltip?: string;
}

export interface TextureAddRequestDetail {
  name: string;
  source: HTMLCanvasElement;
  origin: TextureImportOrigin;
  respondWith(work: Promise<unknown>): void;
}

export type TextureChangeSource = "user" | "api";

export interface TextureChangeDetail {
  id: string;
  source: TextureChangeSource;
}

export interface AddTextureOptions {
  activate?: boolean;
}

export interface TextureCloseRequestDetail {
  id: string;
}

export function isTextureImportPolicy(
  value: string
): value is TextureImportPolicy {
  return value === "replace" || value === "add" || value === "ask";
}

export function suggestTextureName(
  fileName: string
): string {
  const baseName = fileName.split(/[\\/]/).at(-1) ?? "";
  const extensionIndex = baseName.lastIndexOf(".");
  const name = extensionIndex > 0 ?
    baseName.slice(0, extensionIndex) :
    baseName;

  return name === "" ? "Texture" : name;
}

export function nextActiveTextureId(
  ids: readonly string[],
  removedId: string,
  activeId: string | null
): string | null {
  if (removedId !== activeId) {
    return activeId;
  }

  const index = ids.indexOf(removedId);
  if (index === -1) {
    return activeId;
  }

  return ids[index + 1] ?? ids[index - 1] ?? null;
}

export function textureCanvasOptions(
  base: PixelArtCanvasOptions,
  texture: PixelDrawTextureOptions | PixelDrawInitializeOptions
): PixelArtCanvasOptions {
  const {
    id: _id,
    name: _name,
    tooltip: _tooltip,
    ...overrides
  } = texture;

  return {
    ...base,
    ...overrides
  };
}

export function sourceProblem(
  source: HTMLCanvasElement,
  maxTextureSize: number
): string | null {
  if (source.width <= 0 || source.height <= 0) {
    return DECODE_FAILED_MESSAGE;
  }
  if (source.width > maxTextureSize || source.height > maxTextureSize) {
    return "Image exceeds the maximum texture size of " +
      `${maxTextureSize}×${maxTextureSize}`;
  }

  return null;
}
