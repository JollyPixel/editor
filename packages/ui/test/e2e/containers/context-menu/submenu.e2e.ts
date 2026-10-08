// Import Internal Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "../../fixtures.ts";

function menuItem(
  page: Page,
  name: string
) {
  return page.getByRole("menuitem", { name, exact: true });
}

async function settledBox(
  locator: Locator
) {
  await locator.evaluate((element) => Promise.all(
    element.getAnimations().map(
      (animation) => animation.finished.catch(() => undefined)
    )
  ));

  return (await locator.boundingBox())!;
}

async function chevronOffset(
  page: Page,
  name: string
) {
  const item = menuItem(page, name);
  const chevron = (await item.locator(".chevron").boundingBox())!;
  const label = (await item.locator(".label").boundingBox())!;

  return chevron.x - label.x;
}

async function openOn(
  page: Page,
  name: string
) {
  await page.locator("button.row", { hasText: name }).click({ button: "right" });
  await expect(page.getByRole("menu", { name: "Row actions" })).toBeVisible();
}

test.describe("Context menu submenus", () => {
  test.use({
    example: "containers/context-menu"
  });

  test("hovering opens a cascade on the right and a nested choice is emitted", async({ page }) => {
    await openOn(page, "Arm");
    const root = page.getByRole("menu", { name: "Row actions" });

    await menuItem(page, "Add").hover();
    const add = page.getByRole("menu", { name: "Add" });
    await expect(add).toBeVisible();
    await expect(menuItem(page, "Add")).toHaveAttribute("aria-expanded", "true");
    await expect(menuItem(page, "Add")).toBeFocused();

    const rootBox = await settledBox(root);
    const addBox = await settledBox(add);
    expect(addBox.x).toBeGreaterThanOrEqual(rootBox.x + rootBox.width - 1);
    expect(await chevronOffset(page, "Add")).toBeGreaterThan(0);

    await menuItem(page, "Shape").hover();
    await expect(page.getByRole("menu", { name: "Shape" })).toBeVisible();
    await menuItem(page, "Sphere").click();

    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.locator("main > div")).toHaveAttribute("data-result", "add-sphere:Arm");
    await expect(page.locator("button.row", { hasText: "Arm" })).toBeFocused();
  });

  test("the keyboard walks into and out of a submenu", async({ page }) => {
    await openOn(page, "Torso");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(menuItem(page, "Add")).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(menuItem(page, "Bone")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(menuItem(page, "Add")).toBeFocused();
    await expect(page.getByRole("menu", { name: "Add" })).toBeHidden();

    await page.keyboard.press("Enter");
    await expect(menuItem(page, "Bone")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Add" })).toBeHidden();
    await expect(menuItem(page, "Add")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.locator("main > div")).not.toHaveAttribute("data-result");
  });

  test("resting on a plain item closes the open submenu", async({ page }) => {
    await openOn(page, "Torso");
    await menuItem(page, "Add").hover();
    await expect(page.getByRole("menu", { name: "Add" })).toBeVisible();

    await menuItem(page, "Duplicate").hover();

    await expect(page.getByRole("menu", { name: "Add" })).toBeHidden();
    await expect(page.getByRole("menu", { name: "Row actions" })).toBeVisible();
  });

  test("cascades on the left near the right edge of the viewport", async({ page }) => {
    await openOn(page, "Wing");
    const rootBox = await settledBox(page.getByRole("menu", { name: "Row actions" }));

    expect(await chevronOffset(page, "Add")).toBeLessThan(0);
    const addLabel = (await menuItem(page, "Add").locator(".label").boundingBox())!;
    const renameLabel = (await menuItem(page, "Rename").locator(".label").boundingBox())!;
    expect(Math.abs(addLabel.x - renameLabel.x)).toBeLessThanOrEqual(1);

    await menuItem(page, "Add").hover();
    const add = page.getByRole("menu", { name: "Add" });
    await expect(add).toBeVisible();
    const addBox = await settledBox(add);
    expect(addBox.x + addBox.width).toBeLessThanOrEqual(rootBox.x + 1);

    expect(await chevronOffset(page, "Shape")).toBeLessThan(0);
    await menuItem(page, "Shape").hover();
    const shape = page.getByRole("menu", { name: "Shape" });
    await expect(shape).toBeVisible();
    const shapeBox = await settledBox(shape);
    expect(shapeBox.x + shapeBox.width).toBeLessThanOrEqual(addBox.x + 1);

    await menuItem(page, "Sphere").click();
    await expect(page.locator("main > div")).toHaveAttribute("data-result", "add-sphere:Wing");
  });

  test("follows its menu when a resize pushes the menu back into the viewport", async({ page }) => {
    await page.locator("jolly-context-menu").evaluate((
      menu: HTMLElementTagNameMap["jolly-context-menu"]
    ) => {
      menu.items = [
        {
          id: "more",
          label: "More",
          items: [{ id: "one", label: "One" }]
        }
      ];
      menu.openAt(400, 40);
    });
    await page.keyboard.press("ArrowRight");
    await expect(menuItem(page, "One")).toBeFocused();

    await page.setViewportSize({ width: 420, height: 400 });

    const root = page.getByRole("menu", { name: "Row actions" });
    const submenu = page.getByRole("menu", { name: "More" });
    await expect.poll(async() => (await root.boundingBox())!.x).toBeLessThan(400);
    const rootBox = await settledBox(root);
    const submenuBox = await settledBox(submenu);
    expect(submenuBox.x + submenuBox.width).toBeLessThanOrEqual(rootBox.x + 1);
    expect(submenuBox.x).toBeGreaterThanOrEqual(0);
  });
});
