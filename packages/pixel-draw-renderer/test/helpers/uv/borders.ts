export function uvBorderRects(
  svg: SVGElement
): SVGRectElement[] {
  return [
    ...svg.querySelectorAll<SVGRectElement>(
      "g > rect:last-child"
    )
  ];
}

export function uvCasingRects(
  svg: SVGElement
): SVGRectElement[] {
  return [
    ...svg.querySelectorAll<SVGRectElement>(
      "g > rect:first-child"
    )
  ];
}

export function uvEntryGroups(
  svg: SVGElement
): SVGGElement[] {
  return [
    ...svg.querySelectorAll<SVGGElement>(
      ":scope > g[data-overlay=\"uv\"] > g"
    )
  ];
}
