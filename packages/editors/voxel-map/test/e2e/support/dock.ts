// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  measureCenter,
  dragTo
} from "@jolly-pixel/e2e";

export type PaneName = "Blocks" | "Materials" | "Paint" | "Layers";
export type DockKey = "left" | "right";

export class PaneDock {
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
  }

  tab(
    name: PaneName
  ): Locator {
    return this.#page.getByRole("tab", {
      name,
      exact: true
    });
  }

  dock(
    key: DockKey
  ): Locator {
    return this.#page.locator(`jolly-dock[key='${key}']`);
  }

  pane(
    key: string
  ): Locator {
    return this.#page.locator(`jolly-pane[key='${key}']`);
  }

  async open(
    name: PaneName
  ): Promise<void> {
    await this.tab(name).click();
  }

  async moveTab(
    name: PaneName,
    dock: DockKey
  ): Promise<void> {
    await dragTo(
      this.#page,
      this.tab(name),
      await measureCenter(this.dock(dock))
    );
  }

  async movePane(
    pane: Locator,
    tab: PaneName
  ): Promise<void> {
    await dragTo(
      this.#page,
      pane.locator(".header").first(),
      await measureCenter(this.tab(tab))
    );
  }
}
