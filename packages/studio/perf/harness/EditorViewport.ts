// Import Third-party Dependencies
import type {
  Frame,
  Page
} from "@playwright/test";

// CONSTANTS
export const VIEWPORT_SCENARIOS = ["away", "hover", "orbit", "panels"] as const;
const kPointerStepMs = 16;
const kNudgeEveryMs = 400;
const kPanelInset = 12;
const kOrbitRadius = 120;
const kOrbitPeriodMs = 2_000;

export type ViewportScenario = typeof VIEWPORT_SCENARIOS[number];

interface Point {
  x: number;
  y: number;
}

interface Box extends Point {
  width: number;
  height: number;
}

export class EditorViewport {
  readonly #page: Page;
  readonly center: Point;
  readonly panel: Point;

  static async locate(
    page: Page,
    frame: Frame
  ): Promise<EditorViewport> {
    let largest: Point & { area: number; } | null = null;
    const canvases: Box[] = [];
    for (const canvas of await frame.locator("canvas").all()) {
      const box = await canvas.boundingBox();
      if (box !== null) {
        canvases.push(box);
      }
      const area = box === null ? 0 : box.width * box.height;
      if (box !== null && area > (largest?.area ?? 0)) {
        largest = {
          x: box.x + (box.width / 2),
          y: box.y + (box.height / 2),
          area
        };
      }
    }
    if (largest === null) {
      throw new Error("The editor frame has no visible canvas");
    }

    const frameBox = await (await frame.frameElement()).boundingBox();
    if (frameBox === null) {
      throw new Error("The editor frame is not visible");
    }

    return new EditorViewport(
      page,
      largest,
      panelPoint(frameBox, canvases)
    );
  }

  constructor(
    page: Page,
    center: Point,
    panel: Point
  ) {
    this.#page = page;
    this.center = center;
    this.panel = panel;
  }

  async prepare(
    scenario: ViewportScenario
  ): Promise<void> {
    const { mouse } = this.#page;
    if (scenario === "away") {
      await mouse.move(1, 1);

      return;
    }
    if (scenario === "panels") {
      await mouse.move(this.panel.x, this.panel.y);

      return;
    }

    await mouse.move(this.center.x - 4, this.center.y);
    await mouse.move(this.center.x, this.center.y, { steps: 2 });
  }

  async play(
    scenario: ViewportScenario,
    durationMs: number
  ): Promise<void> {
    if (scenario === "panels") {
      await this.#nudgePanels(durationMs);

      return;
    }
    if (scenario !== "orbit") {
      await this.#page.waitForTimeout(durationMs);

      return;
    }

    const { mouse } = this.#page;
    await mouse.down({ button: "middle" });
    const started = performance.now();
    for (
      let elapsed = 0;
      elapsed < durationMs;
      elapsed = performance.now() - started
    ) {
      const angle = 2 * Math.PI * elapsed / kOrbitPeriodMs;
      await mouse.move(
        this.center.x + (kOrbitRadius * Math.cos(angle)),
        this.center.y + (kOrbitRadius * Math.sin(angle) / 2)
      );
      await this.#page.waitForTimeout(kPointerStepMs);
    }
    await mouse.up({ button: "middle" });
  }

  async #nudgePanels(
    durationMs: number
  ): Promise<void> {
    const { mouse } = this.#page;
    const started = performance.now();
    for (
      let nudge = 0;
      performance.now() - started < durationMs;
      nudge++
    ) {
      await mouse.move(this.panel.x + (nudge % 2 === 0 ? 3 : 0), this.panel.y);
      await this.#page.waitForTimeout(kNudgeEveryMs);
    }
  }
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
