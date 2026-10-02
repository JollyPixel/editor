// CONSTANTS
const kSvgNs = "http://www.w3.org/2000/svg";

export interface DragGuide {
  update(
    currentX: number
  ): void;
  destroy(): void;
}

/**
 * Creates the document-level guide shown during a scrub drag.
 */
export function createDragGuide(
  originY: number,
  startX: number,
  color: string
): DragGuide {
  const svg = document.createElementNS(
    kSvgNs,
    "svg"
  );
  svg.setAttribute("class", "jolly-scrub-guide");
  Object.assign(svg.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "2147483647"
  });

  const line = document.createElementNS(
    kSvgNs,
    "line"
  );
  line.setAttribute("x1", String(startX));
  line.setAttribute("y1", String(originY));
  line.setAttribute("y2", String(originY));
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "1");
  line.setAttribute(
    "stroke-dasharray",
    "4 3"
  );
  svg.append(line);

  const arrow = document.createElementNS(
    kSvgNs,
    "polygon"
  );
  arrow.setAttribute("fill", color);
  svg.append(arrow);

  document.body.append(svg);

  let lastX: number | null = null;

  function update(
    currentX: number
  ): void {
    if (currentX === lastX) {
      return;
    }
    lastX = currentX;

    line.setAttribute(
      "x2",
      String(currentX)
    );

    // No arrow until the pointer moves.
    if (currentX === startX) {
      arrow.setAttribute(
        "points",
        ""
      );

      return;
    }

    const direction = currentX > startX ? 1 : -1;
    const tipX = currentX + (direction * 5);
    const backX = tipX - (direction * 6);
    arrow.setAttribute(
      "points",
      `${tipX},${originY} ${backX},${originY - 4} ${backX},${originY + 4}`
    );
  }

  // Avoid the SVG default `x2` of zero before the first move.
  update(startX);

  return {
    update,
    destroy(): void {
      svg.remove();
    }
  };
}
