// CONSTANTS
const kSvgNs = "http://www.w3.org/2000/svg";
const kHeadDepth = 4;
const kHeadHalfHeight = 4;
const kTickHalfHeight = 5;

export interface DragGuide {
  update(
    offset: number
  ): void;
  destroy(): void;
}

export function createDragGuide(
  originX: number,
  originY: number,
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

  const group = document.createElementNS(
    kSvgNs,
    "g"
  );
  group.setAttribute(
    "transform",
    `translate(${Math.round(originX) + 0.5} ${Math.round(originY) + 0.5})`
  );
  group.setAttribute("fill", "none");
  group.setAttribute("stroke", color);
  group.setAttribute("stroke-width", "1");
  svg.append(group);

  const body = document.createElementNS(
    kSvgNs,
    "path"
  );
  body.setAttribute("stroke-dasharray", "1");
  group.append(body);

  const head = document.createElementNS(
    kSvgNs,
    "path"
  );
  group.append(head);

  const tick = document.createElementNS(
    kSvgNs,
    "path"
  );
  group.append(tick);

  document.body.append(svg);

  let lastX: number | null = null;

  function update(
    offset: number
  ): void {
    const x = Math.round(offset);
    if (x === lastX) {
      return;
    }
    lastX = x;

    body.setAttribute("d", `M0,0 H${x}`);
    head.setAttribute("d", headPath(x));
    tick.setAttribute("d", `M${x},${-kTickHalfHeight} V${kTickHalfHeight}`);
  }

  update(0);

  return {
    update,
    destroy(): void {
      svg.remove();
    }
  };
}

function headPath(
  x: number
): string {
  const direction = Math.sign(x);
  const tip = x - direction;
  const depth = Math.min(Math.abs(tip), kHeadDepth);
  const back = tip - (direction * depth);

  return `M${back},${-kHeadHalfHeight} L${tip},0 L${back},${kHeadHalfHeight}`;
}
