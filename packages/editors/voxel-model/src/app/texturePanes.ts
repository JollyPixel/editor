// CONSTANTS
export const TEXTURE_PANES = ["build", "paint"] as const;

export type TexturePane = typeof TEXTURE_PANES[number];

export function visibleTexturePane(
  isVisible: (pane: TexturePane) => boolean,
  current: TexturePane
): TexturePane {
  if (isVisible(current)) {
    return current;
  }

  return TEXTURE_PANES.find((pane) => isVisible(pane)) ?? current;
}
