// Import Third-party Dependencies
import type {
  Download,
  Locator,
  Page
} from "@playwright/test";
import {
  CommandConsole,
  dialog
} from "@jolly-pixel/e2e";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

export class Archives {
  readonly importCopyButton: Locator;
  readonly #page: Page;
  readonly #commands: CommandConsole;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.#commands = new CommandConsole(page);
    this.importCopyButton = dialog(page, "Import archive")
      .getByRole("button", { name: "Import as copy" });
  }

  async exportArchive(): Promise<Download> {
    const downloading = this.#page.waitForEvent("download");
    await this.#commands.submit("/archive.export");

    return downloading;
  }

  async importArchive(
    path: string
  ): Promise<void> {
    const choosing = this.#page.waitForEvent("filechooser");
    await this.#commands.submit("/archive.import");
    const chooser = await choosing;
    await chooser.setFiles(path);
  }

  async resetWorkspace(): Promise<void> {
    await this.#commands.submit("/archive.reset");
    await dialog(this.#page, "Reset workspace")
      .getByRole("button", { name: "Reset" })
      .click();
    await this.#page.waitForEvent("load");
    await waitForEditor(this.#page);
  }
}
