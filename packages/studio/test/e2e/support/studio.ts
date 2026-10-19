// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  AccountBadge,
  Roster,
  SignInDialog
} from "./account.ts";
import {
  AssetBrowser,
  SEED_FOLDERS,
  type SeedOptions
} from "./assets.ts";
import { Home } from "./home.ts";
import { SettingsPage } from "./settings.ts";
import { ShareLinksPane } from "./shares.ts";
import {
  EditorFrames,
  EditorTabs
} from "./tabs.ts";

// CONSTANTS
const kExpandedStorageKey = "studio:asset-expanded";

export class StudioShell {
  readonly page: Page;
  readonly assets: AssetBrowser;
  readonly tabs: EditorTabs;
  readonly frames: EditorFrames;
  readonly home: Home;
  readonly signIn: SignInDialog;
  readonly account: AccountBadge;
  readonly roster: Roster;
  readonly shareLinks: ShareLinksPane;
  readonly settings: SettingsPage;
  readonly theme: Locator;
  readonly offlineFallback: Locator;

  constructor(
    page: Page
  ) {
    this.page = page;
    this.assets = new AssetBrowser(page);
    this.tabs = new EditorTabs(page);
    this.frames = new EditorFrames(page);
    this.home = new Home(page);
    this.signIn = new SignInDialog(page);
    this.account = new AccountBadge(page);
    this.roster = new Roster(page);
    this.settings = new SettingsPage(page);
    this.shareLinks = new ShareLinksPane(page, this.account, this.settings);
    this.theme = page.locator("jolly-scope").first();
    this.offlineFallback = page.getByRole("button", { name: "Open offline workspace" });
  }

  async goto(
    path = "/",
    options: SeedOptions = {}
  ): Promise<void> {
    if (!options.collapsed) {
      await this.#expandSeedFolders();
    }
    await this.page.goto(path);
  }

  async open(): Promise<void> {
    await this.goto();
    await this.assets.expectSeeded();
  }

  async openOffline(
    options: SeedOptions = {}
  ): Promise<void> {
    await this.goto("/?offline", options);
    await this.assets.expectSeeded(options);
  }

  async openFromHome(
    name: string
  ): Promise<void> {
    await this.tabs.home.click();
    await this.assets.open(name);
  }

  async #expandSeedFolders(): Promise<void> {
    await this.page.addInitScript(({ key, nodeIds }) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, JSON.stringify(nodeIds));
      }
    }, {
      key: kExpandedStorageKey,
      nodeIds: SEED_FOLDERS.map((folder) => `folder:${folder}`)
    });
  }
}
