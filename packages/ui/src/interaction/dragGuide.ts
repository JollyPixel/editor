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
  line.setAttribute("stroke-dasharray", "4 3");
  svg.append(line);

  const arrow = document.createElementNS(
    kSvgNs,
    "polygon"
  );
  arrow.setAttribute("fill", color);
  svg.append(arrow);

  document.body.append(svg);

  function update(
    currentX: number
  ): void {
    line.setAttribute("x2", String(currentX));

    // No arrow until the pointer moves.
    if (currentX === startX) {
      arrow.setAttribute("points", "");

      return;
    }

    const direction = currentX > startX ? 1 : -1;
    const tipX = currentX + (direction * 5);
    const points = [
      [tipX, originY],
      [tipX - (direction * 6), originY - 4],
      [tipX - (direction * 6), originY + 4]
    ].map((point) => point.join(",")).join(" ");
    arrow.setAttribute("points", points);
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
