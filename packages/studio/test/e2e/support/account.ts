// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import {
  expect,
  type APIRequestContext,
  type Locator,
  type Page
} from "@playwright/test";
import {
  ACCOUNTS_URL_PATH,
  prehashPassword
} from "@jolly-pixel/accounts";

// CONSTANTS
export const E2E_PASSWORD = "e2e-password";

export function uniqueUsername(): string {
  return `e2e-${randomUUID().slice(0, 8)}`;
}

export async function registerAccount(
  request: APIRequestContext,
  username: string = uniqueUsername()
): Promise<string> {
  const response = await request.post(`${ACCOUNTS_URL_PATH}register`, {
    data: {
      username,
      password: await prehashPassword(username, E2E_PASSWORD)
    }
  });
  expect(response.ok()).toBe(true);

  return username;
}

export class SignInDialog {
  readonly root: Locator;
  readonly username: Locator;
  readonly password: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.root = page.getByRole("dialog", { name: "Sign in" });
    this.username = page.getByLabel("Username");
    this.password = page.getByLabel("Password");
  }

  async signIn(
    username: string
  ): Promise<void> {
    await this.#fill(username);
    await this.password.press("Enter");
  }

  async register(
    username: string
  ): Promise<void> {
    await this.#button("Create an account").click();
    await this.#fill(username);
    await this.#button("Create account").click();
  }

  async #fill(
    username: string
  ): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(E2E_PASSWORD);
  }

  #button(
    name: string
  ): Locator {
    return this.#page.getByRole("button", {
      name,
      exact: true
    });
  }
}

export class AccountBadge {
  readonly root: Locator;
  readonly avatar: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.root = page.locator("#studio-actions studio-account");
    this.avatar = this.root.locator("jolly-avatar img");
  }

  async signOut(
    username: string
  ): Promise<void> {
    await this.#choose(username, "Sign out");
  }

  async openSettings(
    username: string
  ): Promise<void> {
    await this.#choose(username, "Settings");
  }

  async #choose(
    username: string,
    item: string
  ): Promise<void> {
    await this.root.getByRole("button", { name: username }).click();
    await this.#page.getByRole("menuitem", { name: item }).click();
  }
}

export class Roster {
  readonly tree: Locator;
  readonly avatar: Locator;

  constructor(
    page: Page
  ) {
    this.tree = page.locator("studio-users jolly-tree");
    this.avatar = this.tree.locator("jolly-avatar img");
  }

  row(
    name: string | RegExp
  ): Locator {
    return this.tree.getByRole("treeitem", { name });
  }
}
