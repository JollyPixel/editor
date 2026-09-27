// Import Third-party Dependencies
import {
  nothing,
  svg
} from "lit";
import { registerIcon } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  MATERIAL_PRESETS,
  type MaterialPreset
} from "./materialPresets.ts";
import { surfaceSwatch } from "../../../shared/materialSwatch.ts";

export function presetIcon(
  preset: MaterialPreset
): string {
  return `material-preset-${preset.id}`;
}

for (const preset of MATERIAL_PRESETS) {
  const { color, ring } = surfaceSwatch(preset.surface);
  registerIcon(presetIcon(preset), svg`
    ${ring === undefined ?
      nothing :
      svg`<circle cx="12" cy="12" r="10" fill="none" stroke=${ring} stroke-width="2" />`}
    <circle cx="12" cy="12" r="7" fill=${color} stroke="currentColor" stroke-width="1.5" />
  `);
}

registerIcon("material-copy", svg`
  <rect
    class="tone-fill"
    x="6"
    y="4"
    width="12"
    height="17"
    rx="2"
    stroke="currentColor"
    stroke-width="1.5"
  />
  <path
    d="M9 4V3h6v1M9 11h6M9 15h4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
  />
`, { tone: "sky" });

registerIcon("material-paste", svg`
  <rect
    class="tone-fill"
    x="6"
    y="4"
    width="12"
    height="17"
    rx="2"
    stroke="currentColor"
    stroke-width="1.5"
  />
  <path
    d="M9 4V3h6v1M12 9v7M9 13l3 3 3-3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });
