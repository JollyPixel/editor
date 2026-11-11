// Import Third-party Dependencies
import {
  PORTS,
  baseUrl
} from "@jolly-pixel/e2e";
import type {
  Frame,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import { SEED_ROW_COUNT } from "../../test/e2e/support/assets.ts";
import { StudioShell } from "../../test/e2e/support/studio.ts";
import type {
  BenchAssetSeed,
  BenchEditor
} from "./BenchEditors.ts";

// CONSTANTS
export const STUDIO_URL = `${baseUrl(PORTS.studio)}/`;
export const STUDIO_MODES = ["online", "offline"] as const;
export const TABS_STORAGE_KEY = "studio:tabs";
export const STUDIO_PREFERENCES_STORAGE_KEY = "jolly-pixel:preferences:studio";
export const STUDIO_PREFERENCES_PATH = "/api/preferences/studio";
const kShellTimeoutMs = 30_000;
const kIdleBeforeOpenMs = 500;

export type StudioMode = typeof STUDIO_MODES[number];

export class StudioPage {
  readonly page: Page;
  readonly mode: StudioMode;
  readonly shell: StudioShell;

  constructor(
    page: Page,
    mode: StudioMode
  ) {
    this.page = page;
    this.mode = mode;
    this.shell = new StudioShell(page);
  }

  async open(): Promise<void> {
    await this.shell.goto(this.mode === "offline" ? "/?offline" : "/");
    await this.shell.assets.rows.nth(SEED_ROW_COUNT - 1).waitFor({
      timeout: kShellTimeoutMs
    });
  }

  async reopenWithoutTabs(): Promise<void> {
    await this.page.evaluate(
      (key) => localStorage.removeItem(key),
      TABS_STORAGE_KEY
    );
    await this.open();
  }

  async waitUntilOpenable(
    editor: BenchEditor
  ): Promise<void> {
    const row = this.shell.assets.row(editor.row);
    if (editor.seed !== undefined && await row.count() === 0) {
      await this.#seed(editor.seed, editor.row);
    }
    await row.waitFor({ timeout: kShellTimeoutMs });
    await this.page.waitForTimeout(kIdleBeforeOpenMs);
  }

  async #seed(
    seed: BenchAssetSeed,
    row: string
  ): Promise<void> {
    const { assets } = this.shell;
    if (seed.kind === "new") {
      await assets.createAsset(seed.menuItem);
      await assets.renameField.press("Escape");

      return;
    }

    const content = await seed.content();
    const transfer = await this.page.evaluateHandle(
      ({ name, base64 }) => {
        const bytes = Uint8Array.from(
          atob(base64),
          (char) => char.charCodeAt(0)
        );
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([bytes], name));

        return dataTransfer;
      },
      {
        name: row,
        base64: Buffer.from(content).toString("base64")
      }
    );
    const card = assets.root.locator(".card.browser");
    await card.dispatchEvent("dragover", { dataTransfer: transfer });
    await card.dispatchEvent("drop", { dataTransfer: transfer });
    await transfer.dispose();
  }

  async openEditor(
    editor: BenchEditor
  ): Promise<Frame> {
    await this.shell.assets.open(editor.row);
    const frameLocator = this.shell.frames.locate(editor.page);
    const element = await frameLocator.owner().elementHandle({
      timeout: kShellTimeoutMs
    });
    const frame = await element?.contentFrame();
    if (!frame) {
      throw new Error(`No frame for ${editor.name}`);
    }
    await this.shell.frames.expectReady(frameLocator);

    return frame;
  }

  async closeEditor(
    editor: BenchEditor
  ): Promise<void> {
    await this.shell.tabs.close(editor.tab);
    await this.shell.frames.locate(editor.page).owner().waitFor({
      state: "detached"
    });
    await this.shell.tabs.home.click();
  }
}
