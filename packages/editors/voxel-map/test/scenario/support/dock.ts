// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export type PaneName = "Blocks" | "Materials" | "Paint" | "Layers";

export class PaneDock {
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
  }

  async open(
    name: PaneName
  ): Promise<void> {
    await this.#page.getByRole("tab", {
      name,
      exact: true
    }).click();
  }
}
