// Import Third-party Dependencies
import { expect } from "@playwright/test";
import {
  checkboxField,
  dialog,
  textField
} from "@jolly-pixel/e2e";
import { Scenario } from "@jolly-pixel/e2e/scenario";

// Import Internal Dependencies
import {
  ModelArchive,
  type ModelExpectation,
  type ModelNodeRow
} from "./support/ModelArchive.ts";
import { ModelPage } from "./support/ModelPage.ts";

// CONSTANTS
const kSkinTint = "#e8b48a";
const kShirtTint = "#4f8a3c";
const kPantsTint = "#5b3a24";
const kLimbSize = { x: 0.5, y: 1.5, z: 0.5 };
const kShoulder = { x: 0, y: 0.75, z: 0 };
const kShirtFront = { x: 0.25, y: -0.4, z: 0.25 };
const kFaceFront = { x: 0.25, y: -0.2, z: 0.5 };
const kFlipX = { x: true, y: false, z: false };

const kBody: ModelNodeRow = {
  path: "Body",
  kind: "block",
  transform: {
    position: { x: 0, y: 2.25, z: 0 },
    size: { x: 1, y: 1.5, z: 0.5 }
  }
};
const kHead: ModelNodeRow = {
  path: "Body/Head",
  kind: "block"
};
const kLimbs: ModelNodeRow = {
  path: "Body/Limbs",
  kind: "folder"
};
const kWorldOrigin = {
  position: { x: 0, y: -2.25, z: 0 }
};
const kLeg: ModelNodeRow = {
  path: "Body/Limbs/Leg",
  kind: "block",
  transform: kWorldOrigin
};
const kArm: ModelNodeRow = {
  path: "Body/Limbs/Arm",
  kind: "block",
  transform: kWorldOrigin
};
const kPlacedHead: ModelNodeRow = {
  ...kHead,
  transform: {
    position: { x: 0, y: 1.25, z: 0 }
  }
};
const kPlacedLeg: ModelNodeRow = {
  ...kLeg,
  transform: {
    position: { x: 0.25, y: -1.5, z: 0 },
    size: kLimbSize
  }
};
const kPlacedArm: ModelNodeRow = {
  ...kArm,
  transform: {
    position: { x: 0.75, y: 0.75, z: 0 },
    pivotOffset: kShoulder,
    size: kLimbSize
  }
};
const kRightLeg: ModelNodeRow = {
  ...kPlacedLeg,
  path: "Body/Limbs/Leg R",
  transform: {
    ...kPlacedLeg.transform,
    position: { x: -0.25, y: -1.5, z: 0 }
  },
  flip: kFlipX
};
const kRightArm: ModelNodeRow = {
  ...kPlacedArm,
  path: "Body/Limbs/Arm R",
  transform: {
    ...kPlacedArm.transform,
    position: { x: -0.75, y: 0.75, z: 0 }
  },
  flip: kFlipX
};
const kHat: ModelNodeRow = {
  path: "Body/Head/Hat",
  kind: "block",
  shape: {
    type: "cylinder",
    sides: 12
  },
  transform: {
    position: { x: 0, y: 0.8, z: 0 },
    size: { x: 0.7, y: 0.6, z: 0.7 }
  },
  uv: "stacked"
};
const kBrim: ModelNodeRow = {
  path: "Body/Head/Hat/Brim",
  kind: "block",
  shape: {
    type: "torus",
    sides: 8,
    ringSides: 10,
    thickness: 0.6
  },
  transform: {
    position: { x: 0, y: -0.3, z: 0 },
    size: { x: 1.2, y: 1.2, z: 0.3 },
    rotation: { x: 90, y: 0, z: 0 }
  },
  uv: "stacked"
};

function dressed(
  node: ModelNodeRow,
  material: string
): ModelNodeRow {
  return {
    ...node,
    material
  };
}

const kBlank: ModelExpectation = {
  nodes: [kBody],
  materials: [],
  animations: [],
  texture: "64x64"
};
const kLimbed: ModelExpectation = {
  ...kBlank,
  nodes: [kBody, kHead, kLimbs, kLeg, kArm]
};
const kPlaced: ModelExpectation = {
  ...kBlank,
  nodes: [kBody, kPlacedHead, kLimbs, kPlacedLeg, kPlacedArm]
};
const kMirrored: ModelExpectation = {
  ...kBlank,
  nodes: [kBody, kPlacedHead, kLimbs, kPlacedLeg, kRightLeg, kPlacedArm, kRightArm]
};
const kHatted: ModelExpectation = {
  ...kBlank,
  nodes: [kBody, kPlacedHead, kHat, kBrim, kLimbs, kPlacedLeg, kRightLeg, kPlacedArm, kRightArm]
};
const kTextured: ModelExpectation = {
  ...kHatted,
  texture: "128x128"
};
const kClothed: ModelExpectation = {
  ...kTextured,
  nodes: [
    dressed(kBody, "Shirt"),
    kPlacedHead,
    kHat,
    kBrim,
    kLimbs,
    dressed(kPlacedLeg, "Pants"),
    dressed(kRightLeg, "Pants"),
    kPlacedArm,
    kRightArm
  ],
  materials: [
    {
      name: "Shirt",
      surface: { color: kShirtTint }
    },
    {
      name: "Pants",
      surface: { color: kPantsTint }
    }
  ]
};
const kDressed: ModelExpectation = {
  ...kClothed,
  nodes: [
    dressed(kBody, "Shirt"),
    dressed(kPlacedHead, "Skin"),
    dressed(kHat, "Metal"),
    dressed(kBrim, "Metal"),
    kLimbs,
    dressed(kPlacedLeg, "Pants"),
    dressed(kRightLeg, "Pants"),
    dressed(kPlacedArm, "Skin"),
    dressed(kRightArm, "Skin")
  ],
  materials: [
    {
      name: "Skin",
      surface: { color: kSkinTint }
    },
    ...kClothed.materials,
    {
      name: "Metal",
      surface: {
        color: "#d0d4da",
        roughness: 0.3,
        metalness: 0.8
      }
    }
  ]
};
const kAnimated: ModelExpectation = {
  ...kDressed,
  animations: [
    {
      name: "Humanoid",
      clips: [
        {
          name: "Wave",
          length: 24000,
          fps: 24,
          loop: false,
          tracks: [
            {
              path: "Body/Arm",
              keys: {
                position: [
                  {
                    tick: 0,
                    value: { x: 0, y: 0, z: 0 }
                  }
                ],
                scale: [
                  {
                    tick: 0,
                    value: { x: 1, y: 1, z: 1 }
                  }
                ],
                rotation: [
                  {
                    tick: 0,
                    value: { x: 0, y: 0, z: 0 }
                  },
                  {
                    tick: 24000,
                    value: { x: 0, y: 0, z: 150 },
                    interpolation: "step"
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
};

new Scenario<ModelPage, ModelExpectation>({
  id: "build-figure",
  title: "build a blocky figure from the blank model and animate it",
  open: async(page) => {
    const model = new ModelPage(page);
    await model.openOffline();

    return model;
  },
  describe: (archive) => new ModelArchive(archive).describe(),
  chapters: [
    {
      id: "blank",
      title: "the blank model has one block, which becomes the body",
      play: async(model) => {
        await expect(model.transformField("X")).toBeHidden();
        await expect(model.action("Delete")).toBeDisabled();

        await model.row("Block").click();
        await expect(model.region("(Block)front")).toBeVisible();
        await expect(model.transformField("X")).toBeEnabled();
        await expect(model.action("Delete")).toBeEnabled();

        await model.rename("Block", "Body");
        await model.transform("Body", "Size", { y: 1.5, z: 0.5 });
        await model.transform("Body", "Pos", { y: 2.25 });
      },
      expected: kBlank
    },
    {
      id: "hierarchy",
      title: "give the body a head and a folder of limbs, reordered and nested with the keyboard",
      play: async(model) => {
        await model.addNode("Block", "Head", { under: "Body" });
        await model.addAtRoot("Folder", "Limbs");
        await model.addNode("Block", "Arm", { under: "Limbs" });
        await model.addNode("Block", "Leg", { under: "Limbs" });
        await expect(model.region("(Leg)front")).toBeVisible();

        await model.row("Leg").dblclick();
        const rename = model.page.getByRole("textbox", { name: "Rename" });
        await rename.fill("arm");
        await rename.press("Enter");
        await expect(model.page.getByRole("alert"))
          .toHaveText("A root block is already named \"arm\"");
        await rename.press("Escape");

        await model.move("Leg", { down: 3, where: "above" });
        await expect.poll(() => model.outline())
          .toEqual(["Body", "  Head", "Limbs/", "  Leg", "  Arm"]);
        await model.move("Limbs", { down: 1, where: "below" });
        await expect.poll(() => model.outline())
          .toEqual(["Body", "  Head", "  Limbs/", "    Leg", "    Arm"]);
      },
      expected: kLimbed
    },
    {
      id: "transform",
      title: "place the head and limbs by typing, pick a leg in the viewport and drag it along X",
      play: async(model) => {
        await model.transform("Head", "Pos", { y: 1.25 });
        await model.transform("Leg", "Size", { x: 0.5, y: 1.5, z: 0.5 });
        await expect(model.spaceToggle()).toBeDisabled();
        await model.transform("Leg", "Pos", { x: 0.25, y: -1.5 });
        await expect(model.spaceToggle()).toBeEnabled();
        await model.transform("Arm", "Size", { x: 0.5, y: 1.5, z: 0.5 });
        await model.transform("Arm", "Pos", { x: 0.75, y: 0 });
        await model.transform("Arm", "Pivot", { y: 0.75 });

        await model.pick("Leg");
        await expect(model.row("Leg")).toHaveAttribute("aria-selected", "true");
        await model.pickEmpty();
        await expect(model.row("Leg")).toHaveAttribute("aria-selected", "false");
        await expect(model.transformField("X")).toBeHidden();

        await model.select("Leg", "Pos");
        await model.dragGizmo("X");
        await expect.poll(async() => Math.abs((await model.block("Leg")).position.x - 0.25))
          .toBeGreaterThan(0.1);
        expect((await model.block("Leg")).position).toMatchObject({ y: -1.5, z: 0 });
        await model.page.keyboard.press("ControlOrMeta+z");
        await expect.poll(async() => (await model.block("Leg")).position.x).toBe(0.25);
      },
      expected: kPlaced
    },
    {
      id: "mirror",
      title: "mirror the arm and the leg to the other side",
      play: async(model) => {
        for (const limb of ["Leg", "Arm"]) {
          await model.row(limb).click();
          await model.action("Duplicate").click();
          const form = dialog(model.page, "Duplicate");
          await expect(textField(form, "Name")).toHaveValue(`${limb} Copy`);
          await textField(form, "Name").fill(`${limb} R`);
          await checkboxField(form, "X").check();
          await form.getByRole("button", { name: "Duplicate" }).click();
          await expect(model.row(`${limb} R`)).toHaveAttribute("aria-selected", "true");
        }

        const limbs = model.row("Limbs");
        await limbs.getByRole("button", { name: "Hide" }).click();
        await expect.poll(async() => (await model.block("Arm R")).visible).toBe(false);
        await limbs.getByRole("button", { name: "Show" }).click();
        await expect.poll(async() => (await model.block("Arm R")).visible).toBe(true);
      },
      expected: kMirrored
    },
    {
      id: "shapes",
      title: "top the head with a cylinder hat and a torus brim",
      play: async(model) => {
        const sides = model.shapeField("Sides");
        await model.addNode("Block", "Hat", { under: "Head", shape: "Cylinder" });
        await expect(model.shapeSelect().locator("option:checked")).toHaveText("Cylinder");
        await expect(sides).toHaveValue("8");
        await sides.fill("12");
        await sides.press("Enter");
        await expect(model.history("Undo"))
          .toHaveAttribute("label", "Undo Set shape of Hat (Ctrl+Z)");
        await model.undo();
        await expect(sides).toHaveValue("8");
        await model.redo();
        await expect(sides).toHaveValue("12");
        await model.transform("Hat", "Size", { x: 0.7, y: 0.6, z: 0.7 });
        await model.transform("Hat", "Pos", { y: 0.8 });

        await model.addNode("Block", "Brim", { shape: "Torus" });
        await model.shapeField("Ring sides").fill("10");
        await model.shapeField("Ring sides").press("Enter");
        await model.shapeField("Thickness").fill("0.6");
        await model.shapeField("Thickness").press("Enter");
        await model.transform("Brim", "Size", { x: 1.2, y: 1.2, z: 0.3 });
        await model.transform("Brim", "Angle", { x: 90 });
        await model.transform("Brim", "Pos", { y: -0.3 });

        await model.row("Body").click();
        await model.reshape("Body", "Plane");
        await expect(model.shapeSelect().locator("option:checked")).toHaveText("Plane");
        await expect(model.region("(Body)top")).toBeVisible();
        await expect(model.region("(Body)front")).toHaveCount(0);
        await model.page.keyboard.press("ControlOrMeta+z");
        await expect(model.shapeSelect().locator("option:checked")).toHaveText("Box");

        await model.action("Add Block").click();
        const form = dialog(model.page, "New Block");
        await expect(form.getByRole("radio", { name: "Torus", exact: true }))
          .toHaveAttribute("aria-checked", "true");
        await form.getByRole("button", { name: "Cancel" }).click();
        await expect(form).toBeHidden();

        await model.row("Hat").click();
        await model.action("Delete").click();
        const confirm = dialog(model.page, "Delete Block");
        await checkboxField(confirm, "Delete children too").uncheck();
        await confirm.getByRole("button", { name: "Delete" }).click();
        await expect(model.row("Hat")).toHaveCount(0);
        await expect(model.row("Brim")).toBeVisible();
        await model.page.keyboard.press("ControlOrMeta+z");
        await expect(model.row("Hat")).toBeVisible();
      },
      expected: kHatted
    },
    {
      id: "texture",
      title: "grow the texture to make room for every region",
      play: async(model) => {
        const width = model.textureSize("Width");
        await expect(width.locator("option:checked")).toHaveText("64");
        await width.selectOption({ label: "128" });
        await model.textureSize("Height").selectOption({ label: "128" });

        await model.row("Head").click();
        await model.regionState("Stacked");
        await model.regionState("Unfolded");

        const uv = model.page.getByRole("button", { name: "UV", exact: true });
        const paint = model.page.getByRole("button", { name: "Paint", exact: true });
        await expect(uv).toHaveAttribute("aria-pressed", "true");
        await paint.click();
        await expect(paint).toHaveAttribute("aria-pressed", "true");
        await uv.click();
        await expect(uv).toHaveAttribute("aria-pressed", "true");
      },
      expected: kTextured
    },
    {
      id: "clothes",
      title: "dress the body in a green shirt and the legs in brown pants",
      play: async(model) => {
        const { material } = model;
        await material.open("Body");
        await material.create("Material");
        await material.rename("Material", "Shirt");
        await material.tint(kShirtTint);

        await material.holdSlider("Roughness", 0.1);
        await expect.poll(async() => (await material.surface("Body")).roughness)
          .toBeLessThan(0.3);
        await model.page.mouse.up();
        await expect.poll(async() => (await material.surface("Body", "document")).roughness)
          .toBeLessThan(0.3);
        await model.undo();
        await expect.poll(async() => (await material.surface("Body", "document")).roughness)
          .toBe(1);

        await model.row("Leg").click();
        await material.create("Material");
        await material.rename("Material", "Pants");
        await material.tint(kPantsTint);
        await model.row("Leg R").click();
        await material.applyTo("Leg R");
        await expect(material.row("Leg R")).toHaveAttribute("aria-selected", "true");

        await model.openTab("Texture");
        await expect.poll(() => model.tint("Body", kShirtFront)).toBe("green");
      },
      expected: kClothed
    },
    {
      id: "skin",
      title: "give the head and arms a skin tone and the hat a metal finish",
      play: async(model) => {
        const { material } = model;
        await model.openTab("Material");
        await model.row("Head").click();
        await material.create("Material");
        await material.rename("Material", "Skin");
        await material.tint(kSkinTint);
        for (const arm of ["Arm", "Arm R"]) {
          await model.row(arm).click();
          await material.applyTo(arm);
        }

        await model.row("Hat").click();
        await material.create("Metal");
        await model.row("Brim").click();
        await material.applyTo("Brim");

        await material.move("Skin", { down: 0, where: "above" });
        await expect.poll(() => material.outline()).toEqual(["Skin", "Shirt", "Pants", "Metal"]);

        await expect(model.action("Add Block")).toHaveCount(0);
        await model.action("Edit hierarchy").click();
        await expect(model.action("Add Block")).toBeVisible();

        await expect.poll(() => model.tint("Head", kFaceFront)).toBe("red");
        await expect.poll(() => model.tint("Body", kShirtFront)).toBe("green");
      },
      expected: kDressed
    },
    {
      id: "animate",
      title: "key the arm raising from the shoulder, play it and share it as the Humanoid set",
      play: async(model) => {
        const { animate } = model;
        await expect(animate.timeline).toBeHidden();
        await animate.open();
        await expect(animate.panel.getByText("This model has no clip yet.")).toBeVisible();
        await expect(animate.timeline).toBeHidden();
        await animate.addClip("Wave");
        await expect(model.row("Wave")).toHaveAttribute("aria-selected", "true");

        await model.select("Arm", "Angle");
        await animate.keyTool.click();
        await animate.scrubTo(0.99);
        await model.transform("Arm", "Angle", { z: 150 });
        await expect(animate.keys).toHaveCount(2);
        await animate.scrubTo(0.5);
        await expect(animate.playhead).toContainText("Frame 12 / 24");
        await expect.poll(async() => (await model.block("Arm")).rotation.z).toBe(75);

        const menu = animate.timeline.getByRole("menu", { name: "Timeline" });
        await animate.keys.last().click({ button: "right" });
        await menu.getByRole("menuitem", { name: "Interpolation" }).hover();
        await menu.getByRole("menuitem", { name: "Step", exact: true }).click();
        await expect(animate.keys.last()).toHaveAttribute("data-interpolation", "step");

        await animate.playback.getByRole("button", { name: "Play" }).click();
        await expect(animate.playhead).not.toContainText("Frame 12 /");
        await animate.playback.getByRole("button", { name: "Pause" }).click();
        await expect(animate.playback.getByRole("button", { name: "Play" })).toBeVisible();

        await animate.chooseOption("Share as set…");
        const form = dialog(model.page, "Share as Set");
        await textField(form, "Set name").fill("Humanoid");
        await form.getByRole("button", { name: "OK" }).click();
        const shared = animate.panel.getByRole("region", { name: "Shared sets" });
        await expect(shared.getByRole("treeitem", { name: /Humanoid/ })).toBeVisible();

        await model.openTab("Texture");
        await expect(animate.timeline).toBeHidden();
        await expect.poll(async() => (await model.block("Arm")).rotation.z).toBe(0);
      },
      expected: kAnimated
    },
    {
      id: "reload",
      title: "the figure and the flat lighting survive a page reload",
      play: async(model) => {
        await model.pickLighting("Flat");
        await model.reload();
        await expect(model.page.getByRole("button", { name: "Lighting: Flat" })).toBeVisible();
        await expect.poll(() => model.tint("Body", kShirtFront)).toBe("green");
      },
      expected: kAnimated
    },
    {
      id: "round-trip",
      title: "export, wipe the offline data and import the figure back",
      play: async(model) => {
        const download = await model.archives.exportArchive();
        const archivePath = await download.path();

        await model.archives.resetOfflineData();
        await model.archives.importArchive(archivePath);
      },
      expected: kAnimated
    }
  ]
}).register();
