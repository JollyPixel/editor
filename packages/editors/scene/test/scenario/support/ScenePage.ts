// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import type { Vector3Like } from "three";
import type { SceneActorView } from "@jolly-pixel/asset.scene/client";
import {
  dialog,
  selectField,
  textField
} from "@jolly-pixel/e2e";
import {
  EditorToolbar,
  followEditor,
  nextFrames,
  openEditor,
  pressAt,
  reloadEditor
} from "@jolly-pixel/e2e/editor";
import { ArchiveConsole } from "@jolly-pixel/e2e/scenario";

// Import Internal Dependencies
import {
  addActor,
  addComponent,
  editTransform,
  hierarchy,
  inspectedActor,
  inspector,
  sceneTool,
  type TransformAxis,
  type TransformField
} from "./panels.ts";
import {
  actorOverridden,
  actorPoint,
  findActor,
  gizmoHandlePoints,
  type GizmoAxis
} from "./scene.ts";

// CONSTANTS
const kOfflineEditor = {
  maxFps: 10,
  query: {
    offline: "",
    render: "on-demand"
  }
};

export type PaneName = "Hierarchy" | "Inspector" | "Scene";

export class ScenePage {
  readonly page: Page;
  readonly hierarchy: Locator;
  readonly inspector: Locator;
  readonly inspectedActor: Locator;
  readonly archives: ArchiveConsole;
  readonly toolbar: EditorToolbar;

  constructor(
    page: Page
  ) {
    this.page = page;
    this.hierarchy = hierarchy(page);
    this.inspector = inspector(page);
    this.inspectedActor = inspectedActor(page);
    this.archives = new ArchiveConsole(page);
    this.toolbar = new EditorToolbar(page);
  }

  row(
    name: string
  ): Locator {
    return this.hierarchy.getByRole("treeitem").filter({
      has: this.page.getByText(name, { exact: true })
    });
  }

  tool(
    name: string
  ): Locator {
    return sceneTool(this.page, name);
  }

  async openPane(
    name: PaneName
  ): Promise<void> {
    await this.page.getByRole("tab", {
      name,
      exact: true
    }).click();
  }

  addActor(
    path: readonly string[]
  ): Promise<void> {
    return addActor(this.page, path);
  }

  addComponent(
    label: string
  ): Promise<void> {
    return addComponent(this.page, label);
  }

  editTransform(
    field: TransformField,
    axis: TransformAxis,
    value: string
  ): Promise<void> {
    return editTransform(this.page, field, axis, value);
  }

  async pick(
    name: string,
    offset: Vector3Like
  ): Promise<void> {
    await pressAt(this.page, [await actorPoint(this.page, name, offset)]);
  }

  async dragGizmo(
    axis: GizmoAxis
  ): Promise<void> {
    const { mouse } = this.page;
    const [grab, release] = await gizmoHandlePoints(this.page, axis);
    await mouse.move(grab.x, grab.y);
    await nextFrames(this.page);
    await mouse.down();
    await mouse.move(release.x, release.y, { steps: 4 });
    await nextFrames(this.page);
    await mouse.up();
  }

  async dragRow(
    name: string,
    onto: string
  ): Promise<void> {
    const { mouse } = this.page;
    const from = await center(this.row(name));
    const to = await center(this.row(onto));
    await mouse.move(from.x, from.y);
    await mouse.down();
    await mouse.move(to.x, to.y, { steps: 8 });
    await mouse.up();
  }

  async rename(
    name: string
  ): Promise<void> {
    const field = textField(this.inspectedActor, "Name");
    await field.fill(name);
    await field.press("Enter");
  }

  async rowMenu(
    name: string,
    item: string
  ): Promise<void> {
    await this.row(name).click({ button: "right" });
    await this.page.getByRole("menuitem", {
      name: item,
      exact: true
    }).click();
  }

  async select(
    ...names: string[]
  ): Promise<void> {
    const [first, ...others] = names;
    await this.row(first).click();
    for (const name of others) {
      await this.row(name).click({ modifiers: ["ControlOrMeta"] });
    }
    for (const name of names) {
      await expect(this.row(name)).toHaveAttribute("aria-selected", "true");
    }
  }

  async deleteSelected(): Promise<void> {
    await this.hierarchy
      .getByRole("button", { name: "Delete", exact: true })
      .click();
  }

  visible(): Locator {
    return this.inspectedActor.getByRole("checkbox", { name: "Visible" });
  }

  async hide(): Promise<void> {
    await this.inspectedActor.locator("jolly-toggle")
      .filter({ hasText: "Visible" })
      .click();
    await expect(this.visible()).not.toBeChecked();
  }

  component(
    type: string
  ): Locator {
    return this.inspector.locator(`jolly-folder[label="${type}"]`);
  }

  async showMore(
    component: string
  ): Promise<void> {
    const folder = this.component(component);
    await folder.getByRole("button", { name: /^Show \d+ more$/ }).click();
    await expect(folder.getByRole("button", { name: "Show less" })).toBeVisible();
  }

  async editNumber(
    component: string,
    label: string,
    value: string
  ): Promise<void> {
    const input = this.component(component)
      .locator(`jolly-number[label="${label}"] input`);
    await input.fill(value);
    await input.press("Enter");
  }

  async renameScene(
    name: string
  ): Promise<void> {
    await this.toolbar.root.getByRole("button", { name: "Asset actions" }).click();
    await this.page.getByRole("menuitem", { name: "Rename…" }).click();
    const rename = dialog(this.page, "Rename asset");
    await textField(rename, "Name").fill(name);
    await rename.getByRole("button", { name: "Rename" }).click();
    await expect(this.toolbar.assets).toContainText(name);
  }

  async openScene(
    name: string
  ): Promise<void> {
    const current = new URL(this.page.url()).searchParams.get("target");
    await this.toolbar.openAsset(name);
    await followEditor(
      this.page,
      (url) => url.searchParams.get("target") !== current
    );
  }

  async pickAsset(
    title: string,
    name: string
  ): Promise<void> {
    const picker = dialog(this.page, title);
    await picker.getByRole("searchbox").fill(name);
    await picker.getByRole("treeitem")
      .filter({ has: this.page.getByText(name, { exact: true }) })
      .click();
    await picker.getByRole("button", { name: "Pick" }).click();
    await expect(picker).toBeHidden();
  }

  reference(
    component: string,
    label: string
  ): Locator {
    return this.component(component)
      .locator(`jolly-reference[label="${label}"]`);
  }

  async moveComponentUp(
    component: string
  ): Promise<void> {
    const grip = this.component(component).locator(".grip");
    await grip.focus();
    await grip.press("Space");
    await grip.press("ArrowUp");
    await grip.press("Space");
    await expect(grip).toHaveAttribute("aria-pressed", "false");
  }

  environmentSelect(
    label: string
  ): Locator {
    return selectField(this.page.locator("jolly-scene-environment"), label);
  }

  async expand(
    name: string
  ): Promise<void> {
    const row = this.row(name);
    if (await row.getAttribute("aria-expanded") === "false") {
      await row.locator("button.toggle").click();
    }
    await expect(row).toHaveAttribute("aria-expanded", "true");
  }

  async positionX(
    name: string
  ): Promise<number | undefined> {
    return (await this.actor(name))?.transform.position.x;
  }

  overridden(
    name: string
  ): Promise<boolean> {
    return actorOverridden(this.page, name);
  }

  actor(
    name: string
  ): Promise<SceneActorView | null> {
    return findActor(this.page, name);
  }

  async openOffline(): Promise<void> {
    await openEditor(this.page, kOfflineEditor);
  }

  async reload(): Promise<void> {
    await reloadEditor(this.page);
  }
}

async function center(
  locator: Locator
): Promise<{ x: number; y: number; }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("The element has no box to drag from or to.");
  }

  return {
    x: box.x + (box.width / 2),
    y: box.y + (box.height / 2)
  };
}
