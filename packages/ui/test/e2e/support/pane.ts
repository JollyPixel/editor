// Import Third-party Dependencies
import type { Locator, Page } from "@playwright/test";

export class Pane {
  readonly root: Locator;
  readonly header: Locator;
  readonly title: Locator;
  readonly grip: Locator;
  readonly fold: Locator;
  readonly liveRegion: Locator;

  constructor(
    scope: Page | Locator,
    key?: string
  ) {
    this.root = scope.locator(
      key === undefined ? "jolly-pane" : `jolly-pane[key='${key}']`
    );
    this.header = this.root.locator(".header");
    this.title = this.root.locator(".title");
    this.grip = this.root.locator(".grip");
    this.fold = this.root.locator(".fold");
    this.liveRegion = this.root.locator(".live-region");
  }
}

export class PaneGroup {
  readonly root: Locator;
  readonly tabStrip: Locator;
  readonly tabs: Locator;
  readonly selectedTab: Locator;

  constructor(
    scope: Page | Locator
  ) {
    this.root = scope.locator("jolly-pane-group");
    this.tabStrip = this.root.locator(".tabs");
    this.tabs = this.root.getByRole("tab");
    this.selectedTab = this.root.getByRole("tab", { selected: true });
  }

  tab(
    label: string
  ): Locator {
    return this.root.getByRole("tab", {
      name: label,
      exact: true
    });
  }
}
