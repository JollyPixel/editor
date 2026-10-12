// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import type { TreeBadge } from "./contract.ts";
import type { TreeRail } from "./TreeRowLayout.ts";
import type { TreeRowView } from "./TreeRowView.ts";

// CONSTANTS
const kVerticalStroke = html`<svg class="stroke vertical"><line
  x1="0.5" y1="0" x2="0.5" y2="100%"
></line></svg>`;
const kHorizontalStroke = html`<svg class="stroke horizontal"><line
  x1="0" y1="0.5" x2="100%" y2="0.5"
></line></svg>`;
const kRailStrokes: Record<TreeRail, TemplateResult | typeof nothing> = {
  line: kVerticalStroke,
  blank: nothing,
  tee: html`${kVerticalStroke}${kHorizontalStroke}`,
  elbow: html`${kVerticalStroke}${kHorizontalStroke}`,
  start: kVerticalStroke
};

export const BOX_GLYPH = html`<svg class="box-glyph" aria-hidden="true">
  <rect x="0.5" y="0.5" width="10" height="10"></rect>
  <line x1="3" y1="5.5" x2="8" y2="5.5"></line>
  <line class="plus" x1="5.5" y1="3" x2="5.5" y2="8"></line>
</svg>`;

export function renderGuides(
  rails: readonly TreeRail[]
): TemplateResult | typeof nothing {
  if (rails.length === 0) {
    return nothing;
  }

  return html`
    <span class="guides" aria-hidden="true">${rails.map(
      (rail) => html`<span class="rail" data-rail=${rail}>${kRailStrokes[rail]}</span>`
    )}</span>
  `;
}

export function renderIcon(
  view: TreeRowView
): TemplateResult | typeof nothing {
  if (view.avatar !== undefined) {
    return html`
      <jolly-avatar
        class="node-avatar"
        peer-id=${view.avatar.peerId}
        color=${view.avatar.color ?? ""}
        image=${view.avatar.image ?? ""}
        presence=${view.avatar.presence ?? nothing}
      ></jolly-avatar>
    `;
  }
  if (view.icon === undefined) {
    return nothing;
  }

  return html`
    <jolly-icon class="node-icon" name=${view.icon} aria-hidden="true"></jolly-icon>
  `;
}

export function renderWarning(
  view: TreeRowView
): TemplateResult | typeof nothing {
  if (view.warning === undefined) {
    return nothing;
  }

  return html`
    <jolly-icon
      class="warning"
      name="warning"
      role="img"
      aria-label=${view.warning}
      title=${view.warning}
    ></jolly-icon>
  `;
}

export function renderBadges(
  view: TreeRowView
): TemplateResult | typeof nothing {
  if (view.badges.length === 0) {
    return nothing;
  }

  return html`
    <span class="badges">${view.badges.map(renderBadge)}</span>
  `;
}

function renderBadge(
  badge: TreeBadge
): TemplateResult {
  const label = badge.title ?? "Badge";
  const title = badge.title ?? nothing;
  if (badge.icon === undefined) {
    return html`
      <span
        class="badge"
        role="img"
        aria-label=${label}
        title=${title}
        style="background: ${badge.color}"
      ></span>
    `;
  }

  return html`
    <jolly-icon
      class="badge-icon"
      name=${badge.icon}
      role="img"
      aria-label=${label}
      title=${title}
      style="color: ${badge.color}"
    ></jolly-icon>
  `;
}
