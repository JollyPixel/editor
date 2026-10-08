// Import Third-party Dependencies
import type { Locator, Page } from "@playwright/test";
import { boxOf, dragTo } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { Pane } from "./pane.ts";

// CONSTANTS
export const DOCK_HANDLE_SIZE = 4;

export type DockTarget = string | { side: string; };

function dockSelector(
  target?: DockTarget
): string {
  if (target === undefined) {
    return "jolly-dock";
  }

  return typeof target === "string" ?
    `jolly-dock[key='${target}']` :
    `jolly-dock[side='${target.side}']`;
}

export class Dock {
  readonly root: Locator;
  readonly resizeHandle: Locator;
  readonly primaryColumn: Locator;
  readonly secondaryColumn: Locator;
  readonly #page: Page;

  constructor(
    page: Page,
    target?: DockTarget
  ) {
    this.#page = page;
    this.root = page.locator(dockSelector(target));
    this.resizeHandle = this.root.locator(".resize-handle");
    this.primaryColumn = this.root.locator(".primary");
    this.secondaryColumn = this.root.locator(".secondary");
  }

  pane(
    key: string
  ): Pane {
    return new Pane(this.root, key);
  }

  paneKeys(): Promise<string[]> {
    return this.root.evaluate(
      (element) => [...element.querySelectorAll("jolly-pane")].map(
        (pane) => pane.getAttribute("key") ?? ""
      )
    );
  }

  slots(): Promise<string[][]> {
    return this.root.evaluate(
      (element) => [...element.children].map((child) => {
        if (child.tagName === "JOLLY-PANE") {
          return [child.getAttribute("key") ?? ""];
        }

        return [...child.querySelectorAll("jolly-pane")].map(
          (pane) => pane.getAttribute("key") ?? ""
        );
      })
    );
  }

  columns(): Promise<string[][][]> {
    return this.root.evaluate((element) => {
      const columns: string[][][] = [[], []];
      for (const child of element.children) {
        const keys = child.tagName === "JOLLY-PANE" ?
          [child.getAttribute("key") ?? ""] :
          [...child.querySelectorAll("jolly-pane")].map(
            (pane) => pane.getAttribute("key") ?? ""
          );
        columns[child.getAttribute("slot") === "secondary" ? 1 : 0].push(keys);
      }

      return columns;
    });
  }

  async drop(
    handle: Locator,
    offsetFromBottom = 40
  ): Promise<void> {
    const box = await boxOf(this.root);
    await dragTo(this.#page, handle, {
      x: box.x + (box.width / 2),
      y: box.y + box.height - offsetFromBottom
    });
  }
}
