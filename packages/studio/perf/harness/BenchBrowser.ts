// Import Third-party Dependencies
import {
  chromium,
  type Browser,
  type BrowserContext
} from "@playwright/test";

// Import Internal Dependencies
import { registerAccount } from "../../test/e2e/support/account.ts";
import { installProbe } from "./openProbe.ts";
import {
  StudioPage,
  PREFETCH_EDITORS_STORAGE_KEY,
  TABS_STORAGE_KEY,
  type StudioMode
} from "./StudioPage.ts";

// CONSTANTS
const kViewport = {
  width: 1600,
  height: 900
};
const kArgs = [
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows"
];

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
      args: kArgs
    });

    return new BenchBrowser(browser, null);
  }

  static async launchPersistent(
    options: PersistentProfileOptions
  ): Promise<BenchBrowser> {
    const profile = await chromium.launchPersistentContext(options.userDataDir, {
      headless: options.headless ?? false,
      args: kArgs,
      baseURL: options.base,
      viewport: kViewport
    });
    await profile.addInitScript(forgetSavedTabs, TABS_STORAGE_KEY);

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

  async newStudioPage(
    options: StudioPageOptions
  ): Promise<StudioPage> {
    const context = this.#profile ?? await this.browser.newContext({
      baseURL: options.base,
      viewport: kViewport
    });
    await context.addInitScript(
      seedStorage,
      {
        [PREFETCH_EDITORS_STORAGE_KEY]: "off",
        ...options.storage
      }
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
      context.pages().at(0) ?? await context.newPage(),
      options.mode
    );
  }

  async close(): Promise<void> {
    await this.#browser?.close();
    await this.#profile?.close();
  }
}

function seedStorage(
  entries: Record<string, string>
): void {
  try {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  }
  catch {
    console.warn("[perf] localStorage unavailable");
  }
}

function forgetSavedTabs(
  key: string
): void {
  try {
    localStorage.removeItem(key);
  }
  catch {
    console.warn("[perf] localStorage unavailable");
  }
}

function prewarmAdapter(): void {
  const gpu = Reflect.get(navigator, "gpu") as {
    requestAdapter(): Promise<unknown>;
  } | undefined;
  if (window === window.top && gpu !== undefined) {
    void gpu.requestAdapter();
  }
}
