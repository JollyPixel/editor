// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { classMap } from "lit/directives/class-map.js";

// Import Internal Dependencies
import {
  renderIcon,
  type IconName
} from "./icons.ts";

export interface RailButtonOptions {
  part: string;
  label: string;
  tooltip?: string;
  icon: IconName | TemplateResult;
  disabled?: boolean;
  pressed?: boolean;
  onClick: (event: MouseEvent) => void;
}

export function renderRailButton(
  options: RailButtonOptions
): TemplateResult {
  const { part, label, tooltip = label, icon, disabled = false, pressed, onClick } = options;

  return html`
    <button
      class=${classMap({ "rail-btn": true, active: pressed === true })}
      part=${part}
      aria-label=${label}
      aria-pressed=${pressed ?? nothing}
      ?disabled=${disabled}
      @click=${onClick}
    >
      ${typeof icon === "string" ? renderIcon(icon) : icon}
      <span class="tooltip">${tooltip}</span>
    </button>
  `;
}

export const RAIL_DIVIDER = html`<div class="overlay-toolbar-divider"></div>`;
