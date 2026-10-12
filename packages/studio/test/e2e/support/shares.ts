// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";

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
  readonly tab: Locator;
  readonly links: Locator;
  readonly revokeDialog: Locator;
  readonly confirmRevokeButton: Locator;

  constructor(
    page: Page
  ) {
    this.tab = page.getByRole("tab", { name: "Share links" });
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

  async open(): Promise<void> {
    await this.tab.click();
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
