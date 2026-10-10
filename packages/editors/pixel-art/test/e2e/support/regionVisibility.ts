// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

export interface RegionVisibilityState {
  all?: boolean;
  labels?: boolean;
  size?: boolean;
}

export class RegionVisibility {
  readonly trigger: Locator;
  readonly menu: Locator;
  readonly showAll: Locator;
  readonly labels: Locator;
  readonly size: Locator;

  constructor(
    panel: Locator
  ) {
    this.trigger = panel.getByRole("button", { name: "Region visibility" });
    this.menu = panel.getByRole("dialog", { name: "Region visibility" });
    this.showAll = panel.getByRole("checkbox", { name: "Show all regions" });
    this.labels = panel.getByRole("checkbox", { name: "Show region labels" });
    this.size = panel.getByRole("checkbox", { name: "Show UV size" });
  }

  async open(): Promise<void> {
    await this.trigger.click();
  }

  async close(): Promise<void> {
    await this.labels.press("Escape");
  }

  async apply(
    state: RegionVisibilityState
  ): Promise<void> {
    await this.open();
    if (state.all !== undefined) {
      await this.showAll.setChecked(state.all);
    }
    if (state.labels !== undefined) {
      await this.labels.setChecked(state.labels);
    }
    if (state.size !== undefined) {
      await this.size.setChecked(state.size);
    }
    await this.close();
  }
}
