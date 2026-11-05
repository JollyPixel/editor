// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export class Home {
  readonly root: Locator;
  readonly readme: Locator;
  readonly users: Locator;

  constructor(
    page: Page
  ) {
    this.root = page.locator("#studio-home");
    this.readme = page.locator("project-readme");
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

  readmeButton(
    name: string
  ): Locator {
    return this.readme.getByRole("button", {
      name,
      exact: true
    });
  }
}
