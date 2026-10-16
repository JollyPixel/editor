// Import Third-party Dependencies
import type {
  Frame,
  Page
} from "@playwright/test";

// CONSTANTS
export const VIEWPORT_SCENARIOS = ["away", "hover", "orbit"] as const;
const kPointerStepMs = 16;
const kOrbitRadius = 120;
const kOrbitPeriodMs = 2_000;

export type ViewportScenario = typeof VIEWPORT_SCENARIOS[number];

interface Point {
  x: number;
  y: number;
}

export class EditorViewport {
  readonly #page: Page;
  readonly center: Point;

  static async locate(
    page: Page,
    frame: Frame
  ): Promise<EditorViewport> {
    let largest: Point & { area: number; } | null = null;
    for (const canvas of await frame.locator("canvas").all()) {
      const box = await canvas.boundingBox();
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

    return new EditorViewport(page, largest);
  }

  constructor(
    page: Page,
    center: Point
  ) {
    this.#page = page;
    this.center = center;
  }

  async prepare(
    scenario: ViewportScenario
  ): Promise<void> {
    const { mouse } = this.#page;
    if (scenario === "away") {
      await mouse.move(1, 1);

      return;
    }

    await mouse.move(this.center.x - 4, this.center.y);
    await mouse.move(this.center.x, this.center.y, { steps: 2 });
  }

  async play(
    scenario: ViewportScenario,
    durationMs: number
  ): Promise<void> {
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
}
