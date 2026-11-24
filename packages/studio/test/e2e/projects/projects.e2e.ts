// Import Third-party Dependencies
import { PROJECT_URL_PATH } from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import {
  registerAccount,
  signInAccount,
  uniqueUsername
} from "../support/account.ts";
import {
  ProjectsPage,
  confirmDialog
} from "../support/projects.ts";
import { StudioShell } from "../support/studio.ts";
import { SEEDED_PROJECTS } from "./seededProjects.ts";

// CONSTANTS
const kOwner = uniqueUsername();
const kCastle = `/p/${SEEDED_PROJECTS.castle}`;
const kForest = `/p/${SEEDED_PROJECTS.forest}`;

test.describe.configure({ mode: "serial" });

test("the first account owns the server and sees every project, marked when it cannot open", async({
  page,
  studio
}) => {
  await studio.goto(`${kCastle}/`);
  await studio.signIn.register(kOwner);
  await expect(studio.account.root).toContainText(kOwner);
  const projects = new ProjectsPage(page);

  await projects.goto();

  await expect(projects.row(SEEDED_PROJECTS.castle)).toContainText("admin");
  await expect(projects.row(SEEDED_PROJECTS.forest)).toContainText("admin");
  await expect(projects.row(SEEDED_PROJECTS.copy))
    .toContainText(`has the same id as the project "${SEEDED_PROJECTS.castle}"`);
  await expect(projects.row(SEEDED_PROJECTS.copy).getByRole("link")).toHaveCount(0);
});

test("an account joins another project on request, once an admin approves it", async({
  page,
  studio,
  browser,
  baseURL
}) => {
  const member = await registerAccount(page.request, { project: kCastle });
  await studio.goto(`${kForest}/`);
  await expect(page.getByRole("dialog", { name: "Join this project" })).toBeVisible();

  await page.getByRole("button", { name: "Join", exact: true }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Request sent. Sign in once an admin approves it."
  );
  const projects = new ProjectsPage(page);
  await projects.goto();
  await expect(projects.row(SEEDED_PROJECTS.forest)).toContainText("awaiting approval");

  const admin = await browser.newContext({ baseURL });
  try {
    const adminStudio = new StudioShell(await admin.newPage());
    await signInAccount(adminStudio.page.request, kOwner);
    await adminStudio.goto(`${kForest}/`);
    await adminStudio.roster.choose(new RegExp(member), "Approve as", "Member");

    await expect(async() => {
      await page.reload();
      await expect(projects.row(SEEDED_PROJECTS.forest)).toContainText("member", {
        timeout: 1_000
      });
    }).toPass();
  }
  finally {
    await admin.close();
  }
});

test("the owner signs in, then creates, renames, deletes and imports projects", async({ page }) => {
  const projects = new ProjectsPage(page);
  await projects.goto();
  await projects.signIn(kOwner);
  await expect(projects.createForm).toBeVisible();
  const archive = await page.request.get(`${kCastle}${PROJECT_URL_PATH}archive`);
  expect(archive.ok()).toBe(true);

  await projects.create("moon");
  await expect(page).toHaveURL(/\/p\/moon\/$/);
  await projects.goto();
  await projects.rename("moon", "sun");
  await expect(projects.row("sun")).toBeVisible();
  await expect(projects.row("moon")).toHaveCount(0);
  await projects.remove("sun");
  await expect(projects.row("sun")).toHaveCount(0);
  await projects.import("restored", await archive.body());

  await expect(page).toHaveURL(/\/p\/restored\/$/);
  await projects.goto();
  await expect(projects.row("restored")).toContainText("admin");
});

test("the owner removes a member, deletes an account and hands over the server", async({
  page,
  studio,
  request
}) => {
  const removed = await registerAccount(request, { project: kCastle });
  const deleted = await registerAccount(request, { project: kCastle });
  const heir = await registerAccount(request, { project: kCastle });
  await signInAccount(page.request, kOwner);
  await studio.goto(`${kCastle}/`);

  await studio.roster.choose(new RegExp(removed), "Remove from project");
  await confirmDialog(page, `Remove "${removed}" from this project?`, "Remove");
  await expect(studio.roster.row(new RegExp(removed))).toHaveCount(0);

  await studio.roster.choose(new RegExp(deleted), "Delete account");
  await confirmDialog(page, `Delete the account "${deleted}"?`, "Delete");
  await expect(studio.roster.row(new RegExp(deleted))).toHaveCount(0);

  await studio.roster.choose(new RegExp(heir), "Transfer server ownership");
  await confirmDialog(page, `Make "${heir}" the owner?`, "Transfer");
  await expect(studio.roster.row(new RegExp(heir)).getByTitle("Owner")).toBeVisible();

  const projects = new ProjectsPage(page);
  await projects.goto();
  await expect(projects.row(SEEDED_PROJECTS.castle)).toContainText("admin");
  await expect(projects.createForm).toHaveCount(0);
});
