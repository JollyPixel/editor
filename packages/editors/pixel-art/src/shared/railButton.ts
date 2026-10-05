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
  type GlyphName
} from "./icons.ts";

export interface RailButtonOptions {
  part: string;
  label: string;
  tooltip?: string;
  icon: GlyphName | TemplateResult;
  disabled?: boolean;
  pressed?: boolean;
  count?: number;
  text?: string;
  onClick: (event: MouseEvent) => void;
}

export function renderRailButton(
  options: RailButtonOptions
): TemplateResult {
  const {
    part,
    label,
    tooltip = label,
    icon,
    disabled = false,
    pressed,
    count = 0,
    text,
    onClick
  } = options;

  return html`
    <button
      class=${classMap({
        "rail-btn": true,
        active: pressed === true,
        "has-text": text !== undefined
      })}
      part=${part}
      aria-label=${label}
      aria-pressed=${pressed ?? nothing}
      ?disabled=${disabled}
      @click=${onClick}
    >
      ${typeof icon === "string" ? renderIcon(icon) : icon}
      ${text === undefined ?
        nothing :
        html`<span class="rail-text" aria-hidden="true">${text}</span>`}
      ${count > 0 ?
        html`<span class="rail-count" aria-hidden="true">${count}</span>` :
        nothing}
      <span class="tooltip">${tooltip}</span>
    </button>
  `;
}

export const RAIL_DIVIDER = html`<div class="overlay-toolbar-divider"></div>`;
