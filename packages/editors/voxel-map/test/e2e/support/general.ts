// Import Third-party Dependencies
import type {
  Download,
  Locator,
  Page
} from "@playwright/test";
import { dialog } from "@jolly-pixel/e2e";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

export class GeneralPane {
  readonly root: Locator;
  readonly exportButton: Locator;
  readonly resetButton: Locator;
  readonly archiveInput: Locator;
  readonly importCopyButton: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.root = page.locator("map-config-panel");
    this.exportButton = this.root.locator("#export-archive");
    this.resetButton = this.root.locator("#reset-workspace");
    this.archiveInput = this.root.locator("input[type=file]");
    this.importCopyButton = dialog(page, "Import archive")
      .getByRole("button", { name: "Import as copy" });
  }

  async exportArchive(): Promise<Download> {
    const downloading = this.#page.waitForEvent("download");
    await this.exportButton.click();

    return downloading;
  }

  async importArchive(
    path: string
  ): Promise<void> {
    await this.archiveInput.setInputFiles(path);
  }

  async resetWorkspace(): Promise<void> {
    await this.resetButton.click();
    await dialog(this.#page, "Reset workspace")
      .getByRole("button", { name: "Reset" })
      .click();
    await this.#page.waitForEvent("load");
    await waitForEditor(this.#page);
  }
}
