// Import Internal Dependencies
import { SVG_NS } from "../constants.ts";
import type { ScreenProjection } from "../Viewport.ts";
import type { SelectionRect } from "../../types.ts";

// CONSTANTS
const kColor = "#ef4444";
const kDashArray = "6 4";
const kOutlineOpacity = "0.35";
const kLabelOpacity = "0.6";
const kLabelText = "UV limit";
const kFontSize = 10;
const kPadding = 4;

interface LimitElements {
  outline: SVGRectElement;
  label: SVGTextElement;
}

export class UVOverflowLimit {
  #group: SVGGElement;
  #elements: LimitElements | null = null;

  constructor(
    group: SVGGElement
  ) {
    this.#group = group;
  }

  render(
    limit: SelectionRect | null,
    view: ScreenProjection
  ): void {
    if (limit === null) {
      this.destroy();

      return;
    }

    const { outline, label } = this.#elements ?? this.#create();
    const screen = view.toScreenRect(limit);
    outline.setAttribute("x", String(screen.x));
    outline.setAttribute("y", String(screen.y));
    outline.setAttribute("width", String(screen.width));
    outline.setAttribute("height", String(screen.height));
    label.setAttribute("x", String(screen.x));
    label.setAttribute("y", String(screen.y - kPadding));
    this.#group.prepend(outline, label);
  }

  destroy(): void {
    this.#elements?.outline.remove();
    this.#elements?.label.remove();
    this.#elements = null;
  }

  #create(): LimitElements {
    const outline = document.createElementNS(SVG_NS, "rect");
    outline.setAttribute("part", "uv-overflow-limit");
    outline.setAttribute("fill", "none");
    outline.setAttribute("stroke", kColor);
    outline.setAttribute("stroke-opacity", kOutlineOpacity);
    outline.setAttribute("stroke-width", "1");
    outline.setAttribute("stroke-dasharray", kDashArray);
    outline.style.pointerEvents = "none";

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("part", "uv-overflow-limit-label");
    label.setAttribute("fill", kColor);
    label.setAttribute("fill-opacity", kLabelOpacity);
    Object.assign(label.style, {
      pointerEvents: "none",
      fontSize: `${kFontSize}px`,
      fontFamily: "system-ui, sans-serif",
      userSelect: "none"
    });
    label.textContent = kLabelText;
    this.#elements = { outline, label };

    return this.#elements;
  }
}
