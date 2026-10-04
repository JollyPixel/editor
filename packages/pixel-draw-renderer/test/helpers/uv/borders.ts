export interface UVBorderView {
  readonly element: SVGPathElement;
  readonly style: CSSStyleDeclaration;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
}

function boxOf(
  path: SVGPathElement
): { x: number; y: number; width: number; height: number; } {
  const values = (path.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const xs = values.filter((_value, index) => index % 2 === 0);
  const ys = values.filter((_value, index) => index % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y
  };
}

function viewOf(
  element: SVGPathElement
): UVBorderView {
  return {
    element,
    style: element.style,
    getAttribute(name) {
      if (name === "x" || name === "y" || name === "width" || name === "height") {
        return String(boxOf(element)[name]);
      }

      return element.getAttribute(name);
    },
    hasAttribute(name) {
      return element.hasAttribute(name);
    }
  };
}

export function uvEntryGroups(
  svg: SVGElement
): SVGGElement[] {
  return [
    ...svg.querySelectorAll<SVGGElement>(
      "g[data-overlay=\"uv\"] > g"
    )
  ];
}

export function uvBorderRects(
  svg: SVGElement
): UVBorderView[] {
  return uvEntryGroups(svg).map((group) => viewOf(group.querySelectorAll("path")[1]));
}

export function uvCasingRects(
  svg: SVGElement
): UVBorderView[] {
  return uvEntryGroups(svg).map((group) => viewOf(group.querySelectorAll("path")[0]));
}
