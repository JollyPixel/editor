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
import { surfaceSwatch } from "../materialSwatch.ts";

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
