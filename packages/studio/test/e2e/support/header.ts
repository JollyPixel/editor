// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export class StudioHeader {
  readonly actions: Locator;

  constructor(
    page: Page
  ) {
    this.actions = page.locator("#studio-actions studio-header-actions");
  }

  action(
    name: string
  ): Locator {
    return this.actions.getByRole("button", {
      name,
      exact: true
    });
  }
}
