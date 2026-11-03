// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";
import { SCRIPT_KIND } from "@jolly-pixel/asset.script";

// CONSTANTS
export const SCRIPT_SOURCE = "const a = 1;\n";

export { expect } from "@playwright/test";

export const test = editorFixture({
  async create(catalog) {
    const id = await catalog.create(
      `${e2eFolder()}/Player.ts`,
      new TextEncoder().encode(SCRIPT_SOURCE),
      { kind: SCRIPT_KIND }
    );

    return { id };
  }
});

export function scriptText(
  page: Page
): Promise<string> {
  return page.evaluate(() => {
    const editor = window as unknown as {
      scriptEditor?: { document: { text: string; }; };
    };

    return editor.scriptEditor?.document.text ?? "";
  });
}

export async function typeAtEnd(
  page: Page,
  text: string
): Promise<void> {
  const source = page.getByRole("textbox", { name: "Script source" });
  await source.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
}
