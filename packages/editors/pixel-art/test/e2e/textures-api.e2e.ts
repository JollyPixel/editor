// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test.describe("texture API", () => {
  test("addTexture can leave the active texture and texture-change reports its source", async({ panel }) => {
    const result = await panel.root.evaluate((element: PixelDrawPanel) => {
      const sources: string[] = [];
      element.addEventListener("texture-change", (event) => {
        sources.push(event.detail.source);
      });
      const firstId = element.activeTextureId;
      element.addTexture(
        { id: "background", name: "Background" },
        { activate: false }
      );
      const afterAdd = element.activeTextureId;
      element.activeTextureId = "background";

      return {
        firstId,
        afterAdd,
        sources,
        ids: element.textures.map((texture) => texture.id)
      };
    });

    expect(result.afterAdd).toBe(result.firstId);
    expect(result.ids).toContain("background");
    expect(result.sources).toEqual(["api"]);

    const userSource = panel.root.evaluate((element: PixelDrawPanel) => {
      const { promise, resolve } = Promise.withResolvers<string>();
      element.addEventListener("texture-change", (event) => resolve(event.detail.source), { once: true });

      return promise;
    });
    await panel.textures.tabs.first().click();

    expect(await userSource).toBe("user");
  });

  test("a single always-shown tab and its add button only raise request events", async({ panel }) => {
    await expect(panel.textures.strip).toHaveCount(0);

    await panel.root.evaluate((element: PixelDrawPanel) => {
      element.textureTabs = "always";
      element.texturesAddable = true;
      element.texturesEditable = true;
      element.addEventListener("texture-create-request", () => {
        element.dataset.created = "yes";
      });
      element.addEventListener("texture-edit-request", (event) => {
        element.dataset.edited = event.detail.id;
      });
    });
    const before = await panel.textures.activeState();
    await expect(panel.textures.tabs).toHaveCount(1);

    await panel.root.getByRole("button", { name: "Add texture" }).click();
    await expect(panel.root).toHaveAttribute("data-created", "yes");

    await panel.textures.tabs.dblclick();
    await expect(panel.root).toHaveAttribute("data-edited", before.activeTextureId!);
    expect(await panel.textures.activeState()).toMatchObject({
      activeTextureId: before.activeTextureId,
      textureIds: before.textureIds
    });
  });

  test("a disabled texture keeps an editable tab but never activates", async({ panel }) => {
    const result = await panel.root.evaluate((element: PixelDrawPanel) => {
      element.texturesEditable = true;
      element.addEventListener("texture-edit-request", (event) => {
        element.dataset.edited = event.detail.id;
      });
      const firstId = element.activeTextureId;
      element.addTexture({
        id: "unlinked",
        name: "Unlinked",
        disabled: true
      });
      element.activeTextureId = "unlinked";

      return {
        firstId,
        activeId: element.activeTextureId
      };
    });
    expect(result.activeId).toBe(result.firstId);

    const unlinked = panel.root.getByRole("tab", { name: "Unlinked" });
    await expect(unlinked).toBeDisabled();
    await unlinked.dblclick({ force: true });
    await expect(panel.root).toHaveAttribute("data-edited", "unlinked");
    expect((await panel.textures.activeState()).activeTextureId).toBe(result.firstId);
  });

  test("the rail toggle turns the strip into a line that names a texture on hover", async({ panel }) => {
    const toggle = panel.root.getByRole("button", { name: "Line texture tabs" });
    await expect(toggle).toHaveCount(0);

    await panel.root.evaluate((element: PixelDrawPanel) => {
      const details: boolean[] = [];
      element.addEventListener("texture-tabs-line-change", (event) => {
        details.push(event.detail);
        element.dataset.lineChanges = details.join(",");
      });
      element.texturesAddable = true;
      element.addTexture(
        { id: "trim", name: "Trim" },
        { activate: false }
      );
    });

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(panel.textures.strip).toHaveAttribute("variant", "line");
    await expect(panel.root.getByRole("button", { name: "Add texture" })).toHaveCount(0);

    const trim = panel.root.getByRole("tab", { name: "Trim" });
    expect((await trim.boundingBox())!.height).toBeLessThanOrEqual(8);
    await trim.hover();
    await expect(panel.textures.strip.locator("[part=tip]").nth(1)).toBeVisible();

    await toggle.click();
    await expect(panel.textures.strip).toHaveAttribute("variant", "default");
    await expect(panel.root).toHaveAttribute("data-line-changes", "true,false");
  });
});
