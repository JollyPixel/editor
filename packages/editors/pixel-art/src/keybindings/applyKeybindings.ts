// Import Third-party Dependencies
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { KeybindingSettings } from "./KeybindingSettings.ts";

export type KeybindingCanvas = Pick<PixelArtCanvas, "keybindings">;

export interface KeybindingPanel extends EventTarget {
  readonly textures: Iterable<{ canvas: KeybindingCanvas; }>;
  readonly canvasManager: KeybindingCanvas | null;
}

export function applyKeybindings(
  panel: KeybindingPanel,
  settings: KeybindingSettings
): () => void {
  function applyToEveryTexture(): void {
    for (const { canvas } of panel.textures) {
      canvas.keybindings.patch(settings.bindings);
    }
  }
  function applyToActiveTexture(): void {
    panel.canvasManager?.keybindings.patch(settings.bindings);
  }

  applyToEveryTexture();
  const unsubscribe = settings.subscribe("change", applyToEveryTexture);
  panel.addEventListener("texture-change", applyToActiveTexture);

  return () => {
    unsubscribe();
    panel.removeEventListener("texture-change", applyToActiveTexture);
  };
}
