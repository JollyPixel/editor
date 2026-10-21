// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import { TourCard } from "./tourCard.ts";

export class LanternExample {
  readonly page: Page;
  readonly card: TourCard;
  readonly spotlight: Locator;
  readonly startButton: Locator;
  readonly helpButton: Locator;
  readonly pane: Locator;
  readonly dock: Locator;
  readonly viewport: Locator;
  readonly clicks: Locator;

  constructor(
    page: Page
  ) {
    this.page = page;
    this.card = new TourCard(page);
    this.spotlight = page.locator("jolly-lantern .ring");
    this.startButton = page.getByRole("button", { name: "Start the tour" });
    this.helpButton = page.getByRole("button", { name: "Help" });
    this.pane = page.locator("#pane");
    this.dock = page.locator("#dock");
    this.viewport = page.getByRole("region", { name: "Viewport" });
    this.clicks = this.viewport.getByRole("status");
  }

  async open(): Promise<void> {
    await this.page.goto("/");
  }

  async startAt(
    stepTitle: string
  ): Promise<void> {
    await this.startButton.click();
    await this.card.advanceTo(stepTitle);
  }
}
