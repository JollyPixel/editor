// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import { E2E_PASSWORD } from "./account.ts";

export class ProjectsPage {
  readonly root: Locator;
  readonly error: Locator;
  readonly createForm: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.root = page.locator("studio-projects");
    this.error = this.root.getByRole("alert");
    this.createForm = this.root.getByRole("form", { name: "New project" });
  }

  async goto(): Promise<void> {
    await this.#page.goto("/");
  }

  async signIn(
    username: string
  ): Promise<void> {
    const form = this.root.getByRole("form", { name: "Sign in" });
    await form.getByPlaceholder("Username").fill(username);
    await form.getByPlaceholder("Password").fill(E2E_PASSWORD);
    await form.getByRole("button", { name: "Sign in" }).click();
  }

  row(
    slug: string
  ): Locator {
    return this.root.locator(`li[data-project="${slug}"]`);
  }

  async create(
    slug: string
  ): Promise<void> {
    await this.createForm.getByRole("textbox").fill(slug);
    await this.createForm.getByRole("button", { name: "Create project" }).click();
  }

  async import(
    slug: string,
    archive: Buffer
  ): Promise<void> {
    const form = this.root.getByRole("form", { name: "Import a project" });
    await form.getByRole("textbox").fill(slug);
    await form.locator("input[type=file]").setInputFiles({
      name: "archive.zip",
      mimeType: "application/zip",
      buffer: archive
    });
    await form.getByRole("button", { name: "Import project" }).click();
  }

  async rename(
    slug: string,
    to: string
  ): Promise<void> {
    await this.row(slug).getByRole("button", { name: "Rename" }).click();
    const dialog = this.#dialog(`Rename "${slug}"`);
    await dialog.getByRole("textbox").fill(to);
    await dialog.getByRole("button", {
      name: "Rename",
      exact: true
    }).click();
  }

  async remove(
    slug: string
  ): Promise<void> {
    await this.row(slug).getByRole("button", { name: "Delete" }).click();
    await confirmDialog(this.#page, `Delete the project "${slug}"?`, "Delete");
  }

  #dialog(
    title: string
  ): Locator {
    return this.#page.locator("jolly-dialog").filter({ hasText: title });
  }
}

export function confirmDialog(
  page: Page,
  title: string,
  action: string
): Promise<void> {
  return page.locator("jolly-dialog")
    .filter({ hasText: title })
    .getByRole("button", {
      name: action,
      exact: true
    })
    .click();
}
