// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import type { BootOptions } from "../app/main.ts";

export function gameCanvas(
  page: Page
): Locator {
  return page.locator("#game");
}

export function bootRuntime(
  page: Page,
  options: BootOptions = {}
): Promise<void> {
  return page.evaluate(
    (bootOptions) => window.runtimeE2E.boot(bootOptions),
    options
  );
}

export function isRunning(
  page: Page
): Promise<boolean> {
  return page.evaluate(() => window.runtimeE2E.runtime.running);
}

export function ticksOverFrames(
  page: Page,
  frames: number
): Promise<number> {
  return page.evaluate(async(frameCount) => {
    const { world } = window.runtimeE2E.runtime;
    let ticks = 0;
    function countTick(): void {
      ticks++;
    }

    world.on("afterUpdate", countTick);
    for (let index = 0; index < frameCount; index++) {
      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });
    }
    world.off("afterUpdate", countTick);

    return ticks;
  }, frames);
}
