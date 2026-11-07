// Import Third-party Dependencies
import {
  BENCH_CHROMIUM_ARGS,
  forgetLocalStorage,
  prewarmGpuAdapter,
  seedLocalStorage,
  type Tracer
} from "@jolly-pixel/cdp";
import {
  chromium,
  type Browser,
  type BrowserContext
} from "@playwright/test";

// Import Internal Dependencies
import { registerAccount } from "../../test/e2e/support/account.ts";
import { installProbe } from "./pageProbe.ts";
import {
  StudioPage,
  STUDIO_PREFERENCES_PATH,
  STUDIO_PREFERENCES_STORAGE_KEY,
  TABS_STORAGE_KEY,
  type StudioMode
} from "./StudioPage.ts";

// CONSTANTS
const kViewport = {
  width: 1600,
  height: 900
};
const kNoPrefetch = {
  prefetchEditors: false
};

export interface BenchBrowserOptions {
  headless?: boolean;
}

export interface PersistentProfileOptions extends BenchBrowserOptions {
  userDataDir: string;
  base: string;
}

export interface StudioPageOptions {
  base: string;
  mode: StudioMode;
  storage?: Record<string, string>;
  /**
   * Lets the shell download the editors ahead of the open.
   * @default false
   */
  prefetch?: boolean;
  prewarm?: boolean;
  probe?: boolean;
}

export class BenchBrowser {
  readonly #browser: Browser | null;
  readonly #profile: BrowserContext | null;

  static async launch(
    options: BenchBrowserOptions = {}
  ): Promise<BenchBrowser> {
    const browser = await chromium.launch({
      headless: options.headless ?? false,
      args: BENCH_CHROMIUM_ARGS
    });

    return new BenchBrowser(browser, null);
  }

  static async launchPersistent(
    options: PersistentProfileOptions
  ): Promise<BenchBrowser> {
    const profile = await chromium.launchPersistentContext(options.userDataDir, {
      headless: options.headless ?? false,
      args: BENCH_CHROMIUM_ARGS,
      baseURL: options.base,
      viewport: kViewport
    });
    await profile.addInitScript(forgetLocalStorage, TABS_STORAGE_KEY);

    return new BenchBrowser(null, profile);
  }

  constructor(
    browser: Browser | null,
    profile: BrowserContext | null
  ) {
    this.#browser = browser;
    this.#profile = profile;
  }

  get browser(): Browser {
    if (this.#browser === null) {
      throw new Error("A persistent profile exposes no Browser handle");
    }

    return this.#browser;
  }

  get tracer(): Tracer | undefined {
    return this.#browser ?? undefined;
  }

  async newStudioPage(
    options: StudioPageOptions
  ): Promise<StudioPage> {
    const context = this.#profile ?? await this.browser.newContext({
      baseURL: options.base,
      viewport: kViewport
    });
    await context.addInitScript(
      seedLocalStorage,
      {
        ...(options.prefetch ? {} : {
          [STUDIO_PREFERENCES_STORAGE_KEY]: JSON.stringify(kNoPrefetch)
        }),
        ...options.storage
      }
    );

    if (options.prewarm) {
      await context.addInitScript(prewarmGpuAdapter);
    }
    if (options.probe) {
      await context.addInitScript(installProbe);
    }
    if (options.mode === "online") {
      await registerAccount(context.request);
      if (!options.prefetch) {
        await context.request.put(STUDIO_PREFERENCES_PATH, {
          data: kNoPrefetch
        });
      }
    }

    return new StudioPage(
      context.pages().at(0) ?? await context.newPage(),
      options.mode
    );
  }

  async close(): Promise<void> {
    await this.#browser?.close();
    await this.#profile?.close();
  }
}
