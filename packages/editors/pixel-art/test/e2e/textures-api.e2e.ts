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

  test("texture-tabs always shows the strip for a single texture, with its badge", async({ panel }) => {
    await expect(panel.textures.strip).toHaveCount(0);

    await panel.root.evaluate((element: PixelDrawPanel) => {
      element.textureTabs = "always";
      element.updateTexture(element.activeTextureId!, { badge: "3" });
    });

    const tab = panel.textures.tabs;
    await expect(tab).toHaveCount(1);
    await expect(tab.locator("[part~=badge]")).toHaveText("3");

    await panel.root.evaluate((element: PixelDrawPanel) => {
      element.updateTexture(element.activeTextureId!, { badge: "" });
    });
    await expect(tab.locator("[part~=badge]")).toHaveCount(0);
  });

  test("the add and edit buttons only raise their request events", async({ panel }) => {
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

    await panel.root.getByRole("button", { name: "Add texture" }).click();
    await expect(panel.root).toHaveAttribute("data-created", "yes");

    await panel.root.getByRole("button", { name: /^Edit / }).click();
    await expect(panel.root).toHaveAttribute("data-edited", before.activeTextureId!);
    expect(await panel.textures.activeState()).toMatchObject({
      activeTextureId: before.activeTextureId,
      textureIds: before.textureIds
    });
  });

  test("a disabled texture keeps a tab and its edit button but never activates", async({ panel }) => {
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

    await expect(panel.root.getByRole("tab", { name: "Unlinked" })).toBeDisabled();
    await panel.root.getByRole("button", { name: "Edit Unlinked" }).click();
    await expect(panel.root).toHaveAttribute("data-edited", "unlinked");
    expect((await panel.textures.activeState()).activeTextureId).toBe(result.firstId);
  });
});
