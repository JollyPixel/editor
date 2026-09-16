// Import Internal Dependencies
import type { FloatingState } from "./layout.ts";

// CONSTANTS
const kExtractMinWidth = 160;
const kExtractMinHeight = 80;

export interface ExtractBox {
  width: number;
  height: number;
}

export interface ExtractSizeOptions {
  remembered?: FloatingState;
  preferred: Partial<ExtractBox>;
  measured: ExtractBox;
  fallback: ExtractBox;
}

export function extractSize(
  options: ExtractSizeOptions
): ExtractBox {
  const {
    remembered,
    preferred,
    measured,
    fallback
  } = options;
  const rendered = measured.width > 0 && measured.height > 0;
  const shown = rendered ? measured : fallback;

  return {
    width: Math.max(
      remembered?.width ?? preferred.width ?? shown.width,
      kExtractMinWidth
    ),
    height: Math.max(
      remembered?.height ?? preferred.height ?? shown.height,
      kExtractMinHeight
    )
  };
}
