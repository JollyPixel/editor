// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export class SettingsPage {
  readonly root: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.root = page.locator("studio-settings");
  }

  section(
    name: string
  ): Locator {
    return this.root
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("treeitem", { name, exact: true });
  }

  editor(
    name: string
  ): Locator {
    return this.root.locator(
      `[role="treeitem"][data-id="editor:${name}"]`
    );
  }

  field(
    key: string
  ): Locator {
    return this.root.locator(`[data-preference="${key}"]`);
  }

  column(
    name: "preferences" | "shortcuts"
  ): Locator {
    return this.root.locator(`[data-column="${name}"]`);
  }

  shortcut(
    scope: string,
    action: string
  ): Locator {
    return this.root.locator(
      `[data-scope="${scope}"] [data-action="${action}"]`
    );
  }

  async changeAvatar(
    png: Buffer
  ): Promise<void> {
    await this.section("Profile").click();
    const chooser = this.#page.waitForEvent("filechooser");
    await this.root.getByRole("button", { name: "Change avatar…" }).click();
    await (await chooser).setFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: png
    });
  }
}
