// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import type { Vector3Like } from "three";
import {
  dialog,
  pixelAt,
  textField,
  treeRow
} from "@jolly-pixel/e2e";
import {
  openEditor,
  pressAt,
  reloadEditor
} from "@jolly-pixel/e2e/editor";
import { ArchiveConsole } from "@jolly-pixel/e2e/scenario";

// Import Internal Dependencies
import { AnimatePanel } from "./animate.ts";
import {
  blockPoint,
  gizmoHandlePoints,
  type Axis
} from "./gizmo.ts";
import { MaterialPanel } from "./material.ts";
import {
  blockSummary,
  outline,
  type BlockSummary
} from "./scene.ts";
import {
  dropByKeyboard,
  type KeyboardDrop
} from "./tree.ts";

// CONSTANTS
const kOfflineEditor = {
  maxFps: 10,
  query: {
    offline: "",
    render: "on-demand"
  }
};
const kTintMargin = 24;

export type ModelTab = "Build" | "Paint" | "Material" | "Animate";
export type NodeKind = "Block" | "Folder";
export type TransformMode = "Pos" | "Angle" | "Size" | "Pivot" | "Scale";
export type RegionState = "Stacked" | "Unfolded" | "Free";
export type Tint = "red" | "green" | "blue" | "neutral";

export interface AddNodeOptions {
  under?: string;
  shape?: string;
}

export class ModelPage {
  readonly page: Page;
  readonly archives: ArchiveConsole;
  readonly material: MaterialPanel;
  readonly animate: AnimatePanel;

  constructor(
    page: Page
  ) {
    this.page = page;
    this.archives = new ArchiveConsole(page);
    this.material = new MaterialPanel(page);
    this.animate = new AnimatePanel(page);
  }

  async openOffline(): Promise<void> {
    await openEditor(this.page, kOfflineEditor);
  }

  async reload(): Promise<void> {
    await reloadEditor(this.page);
  }

  async openTab(
    name: ModelTab
  ): Promise<void> {
    const tab = this.page.getByRole("tab", { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }

  row(
    name: string
  ): Locator {
    return treeRow(this.page, name);
  }

  region(
    label: string
  ): Locator {
    return this.page.getByRole("img").filter({ hasText: label });
  }

  action(
    name: string
  ): Locator {
    return this.page
      .locator(`jolly-model-editor-hierarchy jolly-button[label="${name}"]`)
      .getByRole("button");
  }

  history(
    label: "Undo" | "Redo"
  ): Locator {
    return this.page
      .locator("jolly-model-editor-history jolly-model-editor-history-buttons")
      .locator(`jolly-button[label="${label}"]`);
  }

  async undo(): Promise<void> {
    await this.history("Undo").getByRole("button").click();
  }

  async redo(): Promise<void> {
    await this.history("Redo").getByRole("button").click();
  }

  outline(): Promise<string[]> {
    return outline(this.page);
  }

  block(
    name: string
  ): Promise<BlockSummary> {
    return blockSummary(this.page, name);
  }

  async addNode(
    kind: NodeKind,
    name: string,
    options: AddNodeOptions = {}
  ): Promise<void> {
    const { under, shape } = options;
    if (under === undefined) {
      await this.action(`Add ${kind}`).click();
    }
    else {
      await this.row(under).click({ button: "right" });
      await this.#chooseAdd(kind);
    }
    await this.#submitNewNode(kind, name, shape);
  }

  async addAtRoot(
    kind: NodeKind,
    name: string
  ): Promise<void> {
    const tree = await this.page
      .locator("jolly-model-editor-hierarchy jolly-tree")
      .boundingBox();
    if (tree === null) {
      throw new Error("The hierarchy tree is not visible.");
    }
    await this.page.mouse.click(
      tree.x + 20,
      tree.y + tree.height - 10,
      { button: "right" }
    );
    await this.#chooseAdd(kind);
    await this.#submitNewNode(kind, name);
  }

  async rename(
    from: string,
    to: string
  ): Promise<void> {
    await this.row(from).dblclick();
    const rename = this.page.getByRole("textbox", { name: "Rename" });
    await rename.fill(to);
    await rename.press("Enter");
  }

  async move(
    name: string,
    drop: KeyboardDrop
  ): Promise<void> {
    await dropByKeyboard(this.row(name), drop);
  }

  transformField(
    axis: "X" | "Y" | "Z"
  ): Locator {
    return this.page.getByRole("textbox", { name: axis });
  }

  async select(
    name: string,
    mode: TransformMode
  ): Promise<void> {
    await this.row(name).click();
    await this.page.getByRole("radio", { name: mode }).check();
  }

  async transform(
    name: string,
    mode: TransformMode,
    value: Partial<Vector3Like>
  ): Promise<void> {
    await this.select(name, mode);
    for (const [axis, component] of Object.entries(value)) {
      const field = this.page.getByRole("textbox", { name: axis.toUpperCase() });
      await field.fill(String(component));
      await field.press("Enter");
    }
  }

  async pick(
    name: string
  ): Promise<void> {
    await pressAt(this.page, [await blockPoint(this.page, name)]);
  }

  async pickEmpty(): Promise<void> {
    const canvas = await this.page.locator("#three-renderer canvas").boundingBox();
    if (canvas === null) {
      throw new Error("The viewport canvas is not visible.");
    }

    await pressAt(this.page, [
      {
        x: canvas.x + 8,
        y: canvas.y + (canvas.height / 2)
      }
    ]);
  }

  async dragGizmo(
    axis: Axis
  ): Promise<void> {
    await pressAt(this.page, await gizmoHandlePoints(this.page, axis));
  }

  async tint(
    name: string,
    offset: Vector3Like
  ): Promise<Tint> {
    const { red, green, blue } = await pixelAt(
      this.page,
      await blockPoint(this.page, name, offset)
    );

    if (green > red + kTintMargin && green > blue + kTintMargin) {
      return "green";
    }
    if (red > green + kTintMargin && red > blue + kTintMargin) {
      return "red";
    }

    return blue > red + kTintMargin && blue > green + kTintMargin ? "blue" : "neutral";
  }

  shapeSelect(): Locator {
    return this.page.getByTitle("Shape").getByRole("combobox");
  }

  shapeField(
    label: string
  ): Locator {
    return this.page
      .locator("jolly-model-editor-shape jolly-number")
      .filter({ hasText: label })
      .getByRole("textbox");
  }

  textureSize(
    axis: "Width" | "Height"
  ): Locator {
    return this.page.getByTitle(axis).getByRole("combobox");
  }

  async regionState(
    state: RegionState
  ): Promise<void> {
    const toolbar = this.page.getByRole("button", { name: /^Region state/ });
    await toolbar.click();
    await this.page.getByRole("menuitem", { name: state }).click();
    await expect(toolbar).toHaveAccessibleName(`Region state: ${state}`);
  }

  async pickLighting(
    mode: string
  ): Promise<void> {
    await this.page.getByRole("button", { name: /^Lighting:/ }).click();
    await this.page.getByRole("menuitem", { name: mode, exact: true }).click();
    await expect(this.page.getByRole("button", { name: `Lighting: ${mode}` })).toBeVisible();
  }

  async #chooseAdd(
    kind: NodeKind
  ): Promise<void> {
    await this.page
      .getByRole("menu", { name: "Hierarchy actions" })
      .getByRole("menuitem", { name: new RegExp(`^Add (Child )?${kind}$`) })
      .click();
  }

  async #submitNewNode(
    kind: NodeKind,
    name: string,
    shape?: string
  ): Promise<void> {
    const form = dialog(this.page, `New ${kind}`);
    if (shape !== undefined) {
      await form.getByRole("radio", { name: shape, exact: true }).click();
    }
    await textField(form, `${kind} name`).fill(name);
    await form.getByRole("button", { name: "OK" }).click();
    await expect(form).toBeHidden();
    await expect(this.row(name)).toBeVisible();
  }
}
