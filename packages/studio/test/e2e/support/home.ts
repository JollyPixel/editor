// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export class Home {
  readonly root: Locator;
  readonly assetTotal: Locator;
  readonly openEditors: Locator;
  readonly users: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.root = page.locator("#studio-home");
    const overview = page.locator("project-overview");
    this.assetTotal = overview.locator(".total");
    this.openEditors = overview.getByRole("region", { name: "Open editors" });
    this.users = this.root.locator("studio-users");
  }

  tool(
    name: string
  ): Locator {
    return this.root.locator("#studio-tools").getByRole("button", {
      name,
      exact: true
    });
  }

  openEditor(
    name: string
  ): Locator {
    return this.openEditors.locator("jolly-button").filter({
      has: this.#page.getByRole("button", {
        name,
        exact: true
      })
    });
  }
}
