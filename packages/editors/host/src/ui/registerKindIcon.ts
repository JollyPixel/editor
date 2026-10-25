// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import {
  isIconTone,
  registerIcon,
  type IconName
} from "@jolly-pixel/ui";

// CONSTANTS
const kKindIconPrefix = "kind:";

export function registerKindIcon(
  descriptor: AssetKindDescriptor
): IconName | undefined {
  const { kind, icon } = descriptor;
  if (icon === undefined) {
    return undefined;
  }

  const { tone } = icon;
  if (tone !== undefined && !isIconTone(tone)) {
    throw new TypeError(
      `Asset kind "${kind}" declares an unknown icon tone "${tone}".`
    );
  }

  const name: IconName = `${kKindIconPrefix}${kind}`;
  registerIcon(name, icon.svg, {
    tone,
    viewBox: icon.viewBox
  });

  return name;
}
