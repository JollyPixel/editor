// Import Third-party Dependencies
import type { StepEnter } from "@jolly-pixel/lantern";

export function showPane(
  pane: string
): StepEnter {
  return ({ page }) => {
    const layout = page.querySelector("jolly-dock-layout");
    if (layout === null) {
      return;
    }

    const previous = layout.placement(pane)?.group.find(
      (key) => layout.placement(key)?.active === true
    );
    layout.showPane(pane);
    if (previous === undefined || previous === pane) {
      return;
    }

    return () => layout.showPane(previous);
  };
}
