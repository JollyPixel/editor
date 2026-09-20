// Import Third-party Dependencies
import type { PixelArtCanvasOptions } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
export const DECODE_FAILED_MESSAGE = "Could not decode the image";

export type TextureImportPolicy = "replace" | "add" | "ask";

export type TextureImportOrigin = "import" | "drop";

export type TextureTabsMode = "auto" | "always";

export interface PixelDrawTextureOptions extends PixelArtCanvasOptions {
  /**
   * Unique key of the texture inside the panel, reported by every texture event.
   */
  id: string;
  /**
   * Label of the texture tab.
   */
  name: string;
  /**
   * Native tooltip of the texture tab.
   * @default ""
   */
  tooltip?: string;
  /**
   * Short chip rendered after the tab label, such as a usage count.
   * The panel gives it no meaning.
   * @default ""
   */
  badge?: string;
  /**
   * A disabled texture keeps its tab but can never become the active one.
   * Its edit button stays usable.
   * @default false
   */
  disabled?: boolean;
}

export interface TextureUpdate {
  /**
   * New tab label. Left unchanged when omitted.
   */
  name?: string;
  /**
   * New tab tooltip. Left unchanged when omitted.
   */
  tooltip?: string;
  /**
   * New tab badge, an empty string removes it. Left unchanged when omitted.
   */
  badge?: string;
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

export interface TextureEditRequestDetail {
  id: string;
}

export function isTextureTabsMode(
  value: string
): value is TextureTabsMode {
  return value === "auto" || value === "always";
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
  texture: Partial<PixelDrawTextureOptions>
): PixelArtCanvasOptions {
  const {
    id: _id,
    name: _name,
    tooltip: _tooltip,
    badge: _badge,
    disabled: _disabled,
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
