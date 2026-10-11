// Import Third-party Dependencies
import {
  expect,
  type FrameLocator,
  type Locator,
  type Page
} from "@playwright/test";
import {
  boxOf,
  dragTo
} from "@jolly-pixel/e2e";

// CONSTANTS
export const MAP_TAB = "overworld";
export const TEXTURE_TAB = "model";
const kEditorBootTimeout = 30_000;

export class EditorTabs {
  readonly root: Locator;
  readonly home: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.root = page.locator("#editor-tabs");
    this.home = this.tab("Home");
  }

  tab(
    name: string
  ): Locator {
    return this.root.getByRole("tab", { name });
  }

  names(): Promise<string[]> {
    return this.root.getByRole("tab").evaluateAll(
      (tabs) => tabs.map(
        (tab) => tab.getAttribute("aria-label") ?? tab.textContent?.trim() ?? ""
      )
    );
  }

  async close(
    name: string
  ): Promise<void> {
    await this.root.getByRole("button", { name: `Close ${name}` }).click();
  }

  async moveFirst(
    name: string
  ): Promise<void> {
    const home = await boxOf(this.home);
    await dragTo(this.#page, this.tab(name), {
      x: home.x + (home.width * 0.75),
      y: home.y + (home.height / 2)
    });
  }
}

export class EditorFrames {
  readonly all: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.all = page.locator("#editor-frames iframe");
  }

  only(): FrameLocator {
    return this.all.contentFrame();
  }

  of(
    editor: string
  ): FrameLocator {
    return this.#page
      .locator(`#editor-frames iframe[src^="editors/${editor}/"]`)
      .contentFrame();
  }

  async expectReady(
    frame: FrameLocator
  ): Promise<void> {
    await expect(frame.locator("html"))
      .toHaveAttribute("data-editor-state", "ready", { timeout: kEditorBootTimeout });
  }
}
