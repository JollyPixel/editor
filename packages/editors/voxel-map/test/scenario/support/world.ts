// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export class MapWorld {
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
  }

  voxelCount(): Promise<number> {
    return this.#page.evaluate(
      () => window.voxelMapEditor!.editing.view.document.world.voxelCount
    );
  }
}
