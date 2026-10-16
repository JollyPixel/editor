// Import Third-party Dependencies
import {
  chromium,
  type Browser
} from "@playwright/test";

// Import Internal Dependencies
import { registerAccount } from "../../test/e2e/support/account.ts";
import {
  installProbe,
  prewarmAdapter,
  seedStorage
} from "./pageProbe.ts";
import {
  StudioPage,
  type StudioMode
} from "./StudioPage.ts";

// CONSTANTS
const kViewport = {
  width: 1600,
  height: 900
};

export interface BenchBrowserOptions {
  headless?: boolean;
}

export interface StudioPageOptions {
  base: string;
  mode: StudioMode;
  storage?: Record<string, string>;
  prewarm?: boolean;
  probe?: boolean;
}

export class BenchBrowser {
  readonly browser: Browser;

  static async launch(
    options: BenchBrowserOptions = {}
  ): Promise<BenchBrowser> {
    const browser = await chromium.launch({
      headless: options.headless ?? false,
      args: [
        "--disable-renderer-backgrounding",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows"
      ]
    });

    return new BenchBrowser(browser);
  }

  constructor(
    browser: Browser
  ) {
    this.browser = browser;
  }

  async newStudioPage(
    options: StudioPageOptions
  ): Promise<StudioPage> {
    const context = await this.browser.newContext({
      baseURL: options.base,
      viewport: kViewport
    });
    await context.addInitScript(
      seedStorage,
      options.storage ?? {}
    );

    if (options.prewarm) {
      await context.addInitScript(prewarmAdapter);
    }
    if (options.probe) {
      await context.addInitScript(installProbe);
    }
    if (options.mode === "online") {
      await registerAccount(context.request);
    }

    return new StudioPage(
      await context.newPage(),
      options.mode
    );
  }

  close(): Promise<void> {
    return this.browser.close();
  }
}
