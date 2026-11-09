// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  dialog,
  textField
} from "@jolly-pixel/e2e";

export class AnimatePanel {
  readonly panel: Locator;
  readonly timeline: Locator;
  readonly keys: Locator;
  readonly keyTool: Locator;
  readonly playback: Locator;
  readonly playhead: Locator;

  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.panel = page.locator("jolly-model-editor-animate-panel");
    this.timeline = page.locator("jolly-model-editor-timeline");
    this.keys = this.timeline.locator(".row[data-block] .key");
    this.keyTool = page
      .locator("jolly-model-editor-viewport-toolbar jolly-tool-button[data-tool=\"key\"]")
      .getByRole("button");
    this.playback = page
      .locator("jolly-model-editor-timeline-transport")
      .getByRole("toolbar", { name: "Playback" });
    this.playhead = this.playback.getByLabel("Playhead");
  }

  tool(
    label: string
  ): Locator {
    return this.panel.locator(`jolly-button[label="${label}"]`).getByRole("button");
  }

  async open(): Promise<void> {
    await this.#page.getByRole("tab", { name: "Animate" }).click();
    await expect(this.panel).toBeVisible();
  }

  async addClip(
    name: string
  ): Promise<void> {
    await this.tool("New clip").click();
    const form = dialog(this.#page, "New Clip");
    await textField(form, "Clip name").fill(name);
    await form.getByRole("button", { name: "OK" }).click();
  }

  async chooseOption(
    name: string
  ): Promise<void> {
    await this.tool("Animations options").click();
    await this.#page.getByRole("menu", { name: "Animation actions" })
      .getByRole("menuitem", { name, exact: true })
      .click();
  }

  async scrubTo(
    fraction: number
  ): Promise<void> {
    const box = await this.timeline.getByLabel("Scrub").boundingBox();
    if (box === null) {
      throw new Error("The timeline ruler is not visible.");
    }
    await this.#page.mouse.click(
      box.x + (box.width * fraction),
      box.y + (box.height / 2)
    );
  }
}
