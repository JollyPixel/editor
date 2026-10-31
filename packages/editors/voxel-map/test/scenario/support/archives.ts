// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import type {
  Download,
  Page
} from "@playwright/test";
import {
  CommandConsole,
  dialog
} from "@jolly-pixel/e2e";
import {
  followEditor,
  reloadEditor
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { MapArchive } from "./MapArchive.ts";

export class Archives {
  readonly #page: Page;
  readonly #commands: CommandConsole;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.#commands = new CommandConsole(page);
  }

  async exportArchive(): Promise<Download> {
    const downloading = this.#page.waitForEvent("download");
    await this.#commands.submit("/archive.export");
    const download = await downloading;
    await this.#commands.close();

    return download;
  }

  async importArchive(
    path: string
  ): Promise<void> {
    const archive = MapArchive.read(await fs.readFile(path));
    const choosing = this.#page.waitForEvent("filechooser");
    await this.#commands.submit("/archive.import");
    const chooser = await choosing;
    await chooser.setFiles(path);
    await followEditor(this.#page, new RegExp(`target=${archive.rootId}`));
  }

  async resetOfflineData(): Promise<void> {
    await this.#commands.submit("/archive.reset");
    await reloadEditor(this.#page, () => dialog(this.#page, "Reset offline data")
      .getByRole("button", { name: "Reset" })
      .click());
  }
}
