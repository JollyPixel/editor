// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import type {
  Download,
  Page
} from "@playwright/test";
import { readAssetArchive } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { CommandConsole } from "../browser/CommandConsole.ts";
import { dialog } from "../browser/locators.ts";
import {
  followEditor,
  reloadEditor
} from "../editor/navigation.ts";

export class ArchiveConsole {
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
    const archive = readAssetArchive(await fs.readFile(path));
    if (!archive.ok) {
      throw archive.val;
    }
    const rootId = archive.val.root?.id;
    await this.#import(path);
    await followEditor(
      this.#page,
      rootId === undefined ? () => true : new RegExp(`target=${rootId}`)
    );
  }

  async importCopy(
    path: string
  ): Promise<void> {
    const current = new URL(this.#page.url()).searchParams.get("target");
    await this.#import(path);
    await dialog(this.#page, "Import archive")
      .getByRole("button", { name: "Import as copy" })
      .click();
    await followEditor(
      this.#page,
      (url) => url.searchParams.get("target") !== current
    );
    if (await this.#commands.prompt.isVisible()) {
      await this.#commands.close();
    }
  }

  async resetOfflineData(): Promise<void> {
    await this.#commands.submit("/archive.reset");
    await reloadEditor(this.#page, () => dialog(this.#page, "Reset offline data")
      .getByRole("button", { name: "Reset" })
      .click());
  }

  async #import(
    path: string
  ): Promise<void> {
    const choosing = this.#page.waitForEvent("filechooser");
    await this.#commands.submit("/archive.import");
    const chooser = await choosing;
    await chooser.setFiles(path);
  }
}
