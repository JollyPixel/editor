// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import type { AccountBadge } from "./account.ts";
import type { SettingsPage } from "./settings.ts";

export class AssetShareDialog {
  readonly root: Locator;
  readonly createButton: Locator;
  readonly copyButton: Locator;
  readonly closeButton: Locator;

  constructor(
    page: Page
  ) {
    this.root = page.locator("asset-share-dialog");
    this.createButton = this.root.getByRole("button", { name: "Create link" });
    this.copyButton = this.root.locator("jolly-button").filter({
      has: page.getByRole("button", { name: "Copy link" })
    });
    this.closeButton = this.root.getByRole("button", { name: "Close" });
  }

  async createLink(): Promise<string> {
    await this.createButton.click();
    await expect(this.copyButton).toHaveAttribute("title", /\/view\//);
    const url = await this.copyButton.getAttribute("title") ?? "";
    await this.closeButton.click();

    return url;
  }
}

export class ShareLinksPane {
  readonly links: Locator;
  readonly revokeDialog: Locator;
  readonly confirmRevokeButton: Locator;

  #account: AccountBadge;
  #settings: SettingsPage;

  constructor(
    page: Page,
    account: AccountBadge,
    settings: SettingsPage
  ) {
    this.#account = account;
    this.#settings = settings;
    this.links = page.locator("studio-share-links share-link-list")
      .getByRole("listitem");
    this.revokeDialog = page.getByRole("alertdialog", { name: "Revoke link?" });
    this.confirmRevokeButton = page.locator("jolly-dialog")
      .filter({ has: this.revokeDialog })
      .getByRole("button", {
        name: "Revoke",
        exact: true
      });
  }

  async open(
    username: string
  ): Promise<void> {
    await this.#account.openSettings(username);
    await this.#settings.section("Share links").click();
  }

  async revoke(): Promise<void> {
    await this.links.getByRole("button", { name: "Revoke" }).click();
    await expect(this.revokeDialog).toBeVisible();
    await this.confirmRevokeButton.click();
  }
}

export function joinedRooms(
  page: Page
): string[] {
  const rooms: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      const envelope = typeof payload === "string" ? JSON.parse(payload) : null;
      if (envelope?.kind === "join") {
        rooms.push(envelope.room);
      }
    });
  });

  return rooms;
}
