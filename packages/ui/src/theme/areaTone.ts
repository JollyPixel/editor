// Import Internal Dependencies
import {
  iconTone,
  isIconTone,
  type IconName,
  type IconTone
} from "../icon/registry.ts";

export function resolveAreaTone(
  tone: string,
  icon: IconName
): IconTone | null {
  return isIconTone(tone) ? tone : iconTone(icon);
}

export function applyAreaTone(
  host: HTMLElement,
  tone: IconTone | null
): void {
  host.toggleAttribute("toned", tone !== null);
  if (tone === null) {
    host.style.removeProperty("--jolly-area-tone");
    host.style.removeProperty("--jolly-area-fill");

    return;
  }

  host.style.setProperty("--jolly-area-tone", `var(--jolly-tone-${tone})`);
  host.style.setProperty("--jolly-area-fill", `var(--jolly-tone-${tone}-fill)`);
}
