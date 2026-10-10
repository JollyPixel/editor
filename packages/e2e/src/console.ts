// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";

export class CommandConsole {
  readonly prompt: Locator;
  readonly log: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.prompt = page.getByRole("combobox", { name: "Command" });
    this.log = page.getByRole("log", { name: "Console output" });
  }

  async open(): Promise<void> {
    await this.#page.keyboard.press("Control+k");
    await expect(this.prompt).toBeFocused();
  }

  async close(): Promise<void> {
    await this.#page.keyboard.press("Escape");
  }

  async submit(
    line: string
  ): Promise<void> {
    if (!await this.prompt.isVisible()) {
      await this.open();
    }
    await this.prompt.fill(line);
    await this.prompt.press("Enter");
    await expect(this.log).toContainText(line);
  }
}
