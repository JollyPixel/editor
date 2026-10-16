// Import Third-party Dependencies
import type {
  Frame,
  Page
} from "@playwright/test";

export type ViewportScenario = typeof VIEWPORT_SCENARIOS[number];

interface Point {
  x: number;
  y: number;
}

interface Box extends Point {
  width: number;
  height: number;
}

type Anchor = "pageCorner" | "canvasCenter" | "panel";
type Motion = "still" | "orbit" | "nudge";

interface ScenarioPlan {
  anchor: Anchor;
  motion: Motion;
}

// CONSTANTS
export const VIEWPORT_SCENARIOS = ["away", "hover", "orbit", "panels"] as const;
const kScenarios: Record<ViewportScenario, ScenarioPlan> = {
  away: { anchor: "pageCorner", motion: "still" },
  hover: { anchor: "canvasCenter", motion: "still" },
  orbit: { anchor: "canvasCenter", motion: "orbit" },
  panels: { anchor: "panel", motion: "nudge" }
};
const kPageCorner: Point = { x: 5, y: 1 };
const kApproachPx = 4;
const kPointerStepMs = 16;
const kNudgeEveryMs = 400;
const kPanelInset = 12;
const kOrbitRadius = 120;
const kOrbitPeriodMs = 2_000;

export class EditorViewport {
  readonly #page: Page;
  readonly #anchors: Record<Anchor, Point>;

  static async locate(
    page: Page,
    frame: Frame
  ): Promise<EditorViewport> {
    const canvases = (
      await Promise.all(
        (await frame.locator("canvas").all()).map((canvas) => canvas.boundingBox())
      )
    ).filter((box) => box !== null);
    const [largest] = canvases.toSorted((left, right) => area(right) - area(left));
    if (largest === undefined || area(largest) === 0) {
      throw new Error("The editor frame has no visible canvas");
    }

    const frameBox = await (await frame.frameElement()).boundingBox();
    if (frameBox === null) {
      throw new Error("The editor frame is not visible");
    }

    return new EditorViewport(page, {
      pageCorner: kPageCorner,
      canvasCenter: {
        x: largest.x + (largest.width / 2),
        y: largest.y + (largest.height / 2)
      },
      panel: panelPoint(frameBox, canvases)
    });
  }

  constructor(
    page: Page,
    anchors: Record<Anchor, Point>
  ) {
    this.#page = page;
    this.#anchors = anchors;
  }

  async prepare(
    scenario: ViewportScenario
  ): Promise<void> {
    const { mouse } = this.#page;
    const { x, y } = this.#anchors[kScenarios[scenario].anchor];
    await mouse.move(x - kApproachPx, y);
    await mouse.move(x, y, { steps: 2 });
  }

  async play(
    scenario: ViewportScenario,
    durationMs: number
  ): Promise<void> {
    switch (kScenarios[scenario].motion) {
      case "still":
        await this.#page.waitForTimeout(durationMs);
        break;
      case "orbit":
        await this.#orbit(durationMs);
        break;
      case "nudge":
        await this.#nudge(durationMs);
        break;
    }
  }

  async #orbit(
    durationMs: number
  ): Promise<void> {
    const { mouse } = this.#page;
    const center = this.#anchors.canvasCenter;
    await mouse.down({ button: "middle" });
    const started = performance.now();
    for (
      let elapsed = 0;
      elapsed < durationMs;
      elapsed = performance.now() - started
    ) {
      const angle = 2 * Math.PI * elapsed / kOrbitPeriodMs;
      await mouse.move(
        center.x + (kOrbitRadius * Math.cos(angle)),
        center.y + (kOrbitRadius * Math.sin(angle) / 2)
      );
      await this.#page.waitForTimeout(kPointerStepMs);
    }
    await mouse.up({ button: "middle" });
  }

  async #nudge(
    durationMs: number
  ): Promise<void> {
    const { mouse } = this.#page;
    const { panel } = this.#anchors;
    const started = performance.now();
    for (
      let nudge = 0;
      performance.now() - started < durationMs;
      nudge++
    ) {
      await mouse.move(panel.x + (nudge % 2 === 0 ? 3 : 0), panel.y);
      await this.#page.waitForTimeout(kNudgeEveryMs);
    }
  }
}

function area(
  box: Box
): number {
  return box.width * box.height;
}

function panelPoint(
  frame: Box,
  canvases: Box[]
): Point {
  const corners: Point[] = [
    { x: frame.x + kPanelInset, y: frame.y + kPanelInset },
    { x: frame.x + frame.width - kPanelInset, y: frame.y + kPanelInset },
    { x: frame.x + kPanelInset, y: frame.y + frame.height - kPanelInset },
    { x: frame.x + frame.width - kPanelInset, y: frame.y + frame.height - kPanelInset }
  ];
  const outside = corners.find((corner) => canvases.every((box) => !contains(box, corner)));
  if (outside === undefined) {
    throw new Error("Every corner of the editor frame is on a canvas");
  }

  return outside;
}

function contains(
  box: Box,
  point: Point
): boolean {
  return point.x >= box.x && point.x <= box.x + box.width &&
    point.y >= box.y && point.y <= box.y + box.height;
}
