// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  dialog,
  textField
} from "../locators.ts";
import { waitForEditor } from "./open.ts";

export class EditorToolbar {
  readonly root: Locator;
  readonly assets: Locator;
  readonly versions: Locator;
  readonly saveButton: Locator;
  readonly readOnly: Locator;
  readonly restoreButton: Locator;
  readonly deleteButton: Locator;
  readonly error: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.root = page.locator("jolly-editor-toolbar");
    this.assets = this.root.locator(".asset jolly-select").getByRole("combobox");
    this.versions = this.root.locator(".version jolly-select").getByRole("combobox");
    this.saveButton = this.root.getByRole("button", { name: "Save version" });
    this.readOnly = this.root.getByText("Read-only", { exact: true });
    this.restoreButton = this.root.getByRole("button", {
      name: "Restore this version"
    });
    this.deleteButton = this.root.getByRole("button", {
      name: "Delete this version"
    });
    this.error = this.root.getByRole("alert");
  }

  async saveVersion(
    name: string,
    message = ""
  ): Promise<void> {
    await this.saveButton.click();
    const newTag = dialog(this.#page, "New tag");
    await textField(newTag, "Name").fill(name);
    if (message !== "") {
      await textField(newTag, "Message").fill(message);
    }
    await newTag.getByRole("button", { name: "Create" }).click();
    await newTag.waitFor({ state: "hidden" });
  }

  async openAsset(
    label: string | RegExp
  ): Promise<void> {
    await pick(this.assets, label);
  }

  async viewVersion(
    label: string | RegExp
  ): Promise<void> {
    await pick(this.versions, label);
  }

  async confirm(
    heading: string,
    button: string
  ): Promise<void> {
    await dialog(this.#page, heading)
      .getByRole("button", { name: button })
      .click();
  }

  async afterNavigation(
    url: RegExp | ((url: URL) => boolean)
  ): Promise<void> {
    await this.#page.waitForURL(url);
    await waitForEditor(this.#page);
  }
}

async function pick(
  select: Locator,
  label: string | RegExp
): Promise<void> {
  const option = select
    .locator("option")
    .filter({ hasText: label })
    .first();
  const value = await option.getAttribute("value");
  await select.selectOption(value ?? "");
}
