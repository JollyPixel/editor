// Import Third-party Dependencies
import type {
  PixelArtCanvas,
  PixelArtCanvasOptions
} from "@jolly-pixel/pixel-draw.renderer";

export type TextureImportPolicy = "replace" | "add" | "ask";

export type TextureImportOrigin = "import" | "drop";

export type TextureImportOutcome = "replaced" | "requested" | "cancelled";

export interface TextureImportRequest {
  canvas: PixelArtCanvas;
  source: HTMLCanvasElement;
  fileName: string;
  origin: TextureImportOrigin;
}

export type TextureImportHandler = (
  request: TextureImportRequest
) => Promise<TextureImportOutcome>;

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

export interface TextureChangeDetail {
  id: string;
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
