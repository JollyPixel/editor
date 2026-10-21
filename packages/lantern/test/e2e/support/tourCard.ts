// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export class TourCard {
  readonly root: Locator;
  readonly title: Locator;

  constructor(
    page: Page
  ) {
    this.root = page.getByRole("dialog");
    this.title = this.root.getByRole("heading", { level: 2 });
  }

  heading(
    name: string
  ): Locator {
    return this.root.getByRole("heading", {
      name,
      exact: true
    });
  }

  button(
    name: string
  ): Locator {
    return this.root.getByRole("button", {
      name,
      exact: true
    });
  }

  async advanceTo(
    stepTitle: string
  ): Promise<void> {
    let current = await this.title.innerText();
    while (current !== stepTitle) {
      await this.root.page().keyboard.press("ArrowRight");
      await this.heading(current).waitFor({ state: "hidden" });
      current = await this.title.innerText();
    }
  }
}
