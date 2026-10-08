// Import Third-party Dependencies
import type { Locator, Page } from "@playwright/test";
import { boxOf, dragTo } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { Pane } from "./pane.ts";

export type ResizeSide = "left" | "right" | "top" | "bottom" | "corner";

export class FloatingWindow {
  readonly root: Locator;
  readonly #page: Page;

  constructor(
    page: Page,
    paneKey?: string
  ) {
    const frames = page.locator("jolly-floating");

    this.#page = page;
    this.root = paneKey === undefined ?
      frames :
      frames.filter({ has: page.locator(`jolly-pane[key='${paneKey}']`) });
  }

  pane(
    key?: string
  ): Pane {
    return new Pane(this.root, key);
  }

  resizeHandle(
    side: ResizeSide
  ): Locator {
    return this.root.locator(`.resize-handle.${side}`);
  }

  async resizeTo(
    size: { width: number; height: number; }
  ): Promise<void> {
    const box = await boxOf(this.root);
    await dragTo(this.#page, this.resizeHandle("right"), {
      x: box.x + size.width,
      y: box.y + (box.height / 2)
    });
    await dragTo(this.#page, this.resizeHandle("bottom"), {
      x: box.x + (size.width / 2),
      y: box.y + size.height
    });
  }
}
