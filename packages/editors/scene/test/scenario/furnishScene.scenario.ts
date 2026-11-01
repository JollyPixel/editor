// Import Third-party Dependencies
import { expect } from "@playwright/test";
import { selectField } from "@jolly-pixel/e2e";
import { Scenario } from "@jolly-pixel/e2e/scenario";

// Import Internal Dependencies
import {
  SceneArchive,
  type SceneActorRow,
  type SceneComponentRow,
  type SceneExpectation
} from "./support/SceneArchive.ts";
import { ScenePage } from "./support/ScenePage.ts";

// CONSTANTS
const kRoom = "scenes/room";
const kLamp = "scenes/lamp";
const kOne = { x: 1, y: 1, z: 1 };
const kOrigin = { x: 0, y: 0, z: 0 };
const kCrateFace = { x: 0, y: -0.3, z: 0.4 };
const kPerspective: SceneComponentRow = {
  type: "Camera",
  data: { projectionMode: "perspective" }
};
const kDirectional: SceneComponentRow = {
  type: "Light",
  data: { kind: "directional", castShadow: true }
};
const kNarrowSpot: SceneComponentRow = {
  type: "Light",
  data: { kind: "spot", castShadow: true, angle: 30 }
};
const kHemisphere: SceneComponentRow = {
  type: "Light",
  data: { kind: "hemisphere" }
};
const kVoxelMap: SceneComponentRow = {
  type: "VoxelMap",
  data: {}
};
const kBox: SceneComponentRow = {
  type: "Mesh",
  data: {
    geometry: { kind: "box" },
    castShadow: true,
    receiveShadow: true
  }
};
const kCamera: SceneActorRow = {
  path: "Main Camera",
  components: [kPerspective],
  position: { x: 0, y: 2, z: 6 },
  scale: kOne,
  visible: true
};
const kSun: SceneActorRow = {
  path: "Sun",
  components: [kDirectional],
  position: { x: 0, y: 10, z: 0 },
  scale: kOne,
  visible: true
};
const kHiddenSun: SceneActorRow = {
  ...kSun,
  visible: false
};
const kSpotSun: SceneActorRow = {
  ...kHiddenSun,
  components: [kNarrowSpot]
};
const kSky: SceneActorRow = {
  path: "Sky",
  components: [kHemisphere],
  position: kOrigin,
  scale: kOne,
  visible: true
};
const kMappedSky: SceneActorRow = {
  ...kSky,
  components: [kVoxelMap, kHemisphere],
  assets: ["voxelmap"]
};
const kCrate: SceneActorRow = {
  path: "Crate",
  components: [kBox],
  position: kOrigin,
  scale: { x: 1, y: 2, z: 1 },
  visible: true
};
const kMovedCrate: SceneActorRow = {
  ...kCrate,
  position: { x: 1.5, y: 0, z: 0 }
};
const kLid: SceneActorRow = {
  ...kMovedCrate,
  path: "Crate/Lid",
  position: kOrigin,
  scale: kOne
};
const kShade: SceneActorRow = {
  ...kMovedCrate,
  path: "Shade"
};
const kBulb: SceneActorRow = {
  ...kLid,
  path: "Shade/Bulb"
};
const kTallBulb: SceneActorRow = {
  ...kBulb,
  scale: { x: 1, y: 3, z: 1 }
};
const kLampInstance: SceneActorRow = {
  path: "lamp",
  components: [],
  position: kOrigin,
  scale: kOne,
  visible: true,
  prefab: kLamp
};
const kDimmedLamp: SceneActorRow = {
  ...kLampInstance,
  overrides: ["Bulb"]
};
const kFog = {
  kind: "linear",
  color: "#c8d2dc",
  near: 10,
  far: 100
} as const;
const kSeedActors = [kCamera, kSun, kSky];
const kFurnishedActors = [kCamera, kSun, kMappedSky, kMovedCrate, kLid];

const kBlank: SceneExpectation = {
  open: kRoom,
  scenes: { [kRoom]: kSeedActors },
  environment: {
    background: null,
    environment: { kind: "none", intensity: 1 },
    fog: { kind: "none" }
  },
  assets: []
};
const kCrated: SceneExpectation = {
  ...kBlank,
  scenes: { [kRoom]: [...kSeedActors, kCrate] }
};
const kMoved: SceneExpectation = {
  ...kBlank,
  scenes: { [kRoom]: [...kSeedActors, kMovedCrate] }
};
const kNested: SceneExpectation = {
  ...kBlank,
  scenes: { [kRoom]: [...kSeedActors, kMovedCrate, kLid] }
};
const kMapped: SceneExpectation = {
  ...kBlank,
  scenes: { [kRoom]: kFurnishedActors },
  assets: ["blockset", "voxelmap"]
};
const kFoggy: SceneExpectation = {
  ...kMapped,
  environment: {
    ...kMapped.environment,
    fog: kFog
  }
};
const kLampPlaced: SceneExpectation = {
  ...kFoggy,
  scenes: {
    [kRoom]: [...kFurnishedActors, kLampInstance],
    [kLamp]: [kShade, kBulb]
  }
};
const kLampApplied: SceneExpectation = {
  ...kLampPlaced,
  scenes: {
    [kRoom]: [...kFurnishedActors, kLampInstance],
    [kLamp]: [kShade, kTallBulb]
  }
};
const kLampReverted: SceneExpectation = {
  ...kLampApplied,
  scenes: {
    ...kLampApplied.scenes,
    [kRoom]: [...kFurnishedActors, kDimmedLamp]
  }
};
const kTidied: SceneExpectation = {
  ...kLampReverted,
  scenes: {
    ...kLampReverted.scenes,
    [kRoom]: [kCamera, kHiddenSun, kMappedSky, kMovedCrate, kLid, kDimmedLamp]
  }
};
const kLit: SceneExpectation = {
  ...kTidied,
  scenes: {
    ...kTidied.scenes,
    [kRoom]: [kCamera, kSpotSun, kMappedSky, kMovedCrate, kLid, kDimmedLamp]
  }
};

new Scenario<ScenePage, SceneExpectation>({
  id: "furnish-scene",
  title: "furnish a scene from a blank one",
  open: async(page) => {
    const scene = new ScenePage(page);
    await scene.openOffline();

    return scene;
  },
  describe: (archive) => new SceneArchive(archive).describe(),
  chapters: [
    {
      id: "blank",
      title: "the blank scene has a camera and two lights, and becomes the room",
      play: async(scene) => {
        await expect(scene.hierarchy.getByRole("treeitem")).toHaveCount(3);
        await scene.renameScene("room");
      },
      expected: kBlank
    },
    {
      id: "crate",
      title: "add a box, undo and redo it, then shape it into a crate",
      play: async(scene) => {
        const undo = scene.tool("undo");
        await expect(undo).toHaveAttribute("disabled");
        await scene.addActor(["Primitive", "Box"]);
        await expect(scene.row("Box")).toHaveAttribute("aria-selected", "true");
        await undo.click();
        await expect(scene.row("Box")).toHaveCount(0);
        await scene.tool("redo").click();
        await expect(scene.row("Box")).toBeVisible();

        await scene.row("Box").click();
        await scene.rename("Crate");
        await expect(scene.row("Crate")).toHaveAttribute("aria-selected", "true");
        await scene.editTransform("Scale", "Y", "2");
      },
      expected: kCrated
    },
    {
      id: "gizmo",
      title: "pick the crate in the viewport and slide it along X on the grid",
      play: async(scene) => {
        await scene.tool("snap").click();
        await expect(scene.tool("snap")).toHaveAttribute("active");
        await scene.row("Main Camera").click();
        await scene.pick("Crate", kCrateFace);
        await expect(scene.row("Crate")).toHaveAttribute("aria-selected", "true");

        await scene.dragGizmo("x");
        await expect.poll(() => scene.positionX("Crate"))
          .toBe(kMovedCrate.position.x);
        await scene.page.keyboard.press("ControlOrMeta+z");
        await expect.poll(() => scene.positionX("Crate")).toBe(0);
        await scene.tool("redo").click();
      },
      expected: kMoved
    },
    {
      id: "hierarchy",
      title: "duplicate the crate into a lid and nest it under the crate",
      play: async(scene) => {
        await scene.rowMenu("Crate", "Duplicate");
        await expect(scene.row("Crate (1)")).toHaveAttribute("aria-selected", "true");
        await scene.rename("Lid");
        await scene.dragRow("Lid", "Crate");
        await expect(scene.row("Lid")).toHaveAttribute("aria-level", "2");
      },
      expected: kNested
    },
    {
      id: "voxel-map",
      title: "give the sky a voxel map, pick it again and move it above the light",
      play: async(scene) => {
        await scene.row("Sky").click();
        await scene.addComponent("Voxel map…");
        await scene.pickAsset("Pick a voxel map", "ground");
        const map = scene.reference("VoxelMap", "Map");
        await expect(map.getByRole("textbox")).toHaveText("ground");

        await map.getByRole("button", { name: "Clear" }).click();
        await expect(map.getByRole("textbox")).toHaveText("<empty>");
        await map.getByRole("button", { name: "Browse" }).click();
        await scene.pickAsset("Pick a voxel map", "ground");
        await expect(map.getByRole("textbox")).toHaveText("ground");

        await scene.moveComponentUp("VoxelMap");
      },
      expected: kMapped
    },
    {
      id: "environment",
      title: "fill the room with linear fog",
      play: async(scene) => {
        await scene.openPane("Scene");
        await scene.environmentSelect("Fog").selectOption({ label: "Linear" });
        await scene.openPane("Inspector");
      },
      expected: kFoggy
    },
    {
      id: "prefab",
      title: "copy the room into a lamp scene and place an instance of it in the room",
      play: async(scene) => {
        const download = await scene.archives.exportArchive();
        await scene.archives.importCopy(await download.path());
        await scene.renameScene("lamp");

        for (const name of ["Main Camera", "Sun", "Sky"]) {
          await scene.rowMenu(name, "Delete");
          await expect(scene.row(name)).toHaveCount(0);
        }
        await scene.row("Crate").click();
        await scene.rename("Shade");
        await scene.row("Lid").click();
        await scene.rename("Bulb");

        await scene.openScene("room");
        await scene.addActor(["Scene instance…"]);
        await scene.pickAsset("Pick a scene to include", "lamp");
        await expect(scene.row("lamp")).toHaveAttribute("aria-selected", "true");
      },
      expected: kLampPlaced
    },
    {
      id: "prefab-apply",
      title: "stretch the bulb inside the instance and apply it to the lamp",
      play: async(scene) => {
        await scene.expand("lamp");
        await scene.expand("Shade");
        await scene.row("Bulb").click();
        await scene.editTransform("Scale", "Y", "3");
        await expect.poll(() => scene.overridden("lamp")).toBe(true);

        await scene.rowMenu("lamp", "Apply overrides to prefab");
        await expect.poll(() => scene.overridden("lamp")).toBe(false);
      },
      expected: kLampApplied
    },
    {
      id: "prefab-revert",
      title: "rename the shade and hide the bulb inside the instance, then revert the shade",
      play: async(scene) => {
        await scene.expand("lamp");
        await scene.expand("Shade");
        await scene.row("Shade").click();
        await scene.rename("Big shade");
        await scene.row("Bulb").click();
        await scene.hide();
        await expect.poll(() => scene.overridden("lamp")).toBe(true);

        await scene.rowMenu("Big shade", "Revert overrides");
        await expect(scene.row("Shade")).toBeVisible();
        await expect(scene.row("Big shade")).toHaveCount(0);
      },
      expected: kLampReverted
    },
    {
      id: "tidy",
      title: "hide the sun, then delete the crate and the lamp together and undo it in one step",
      play: async(scene) => {
        await scene.row("Sun").click();
        await scene.hide();

        await scene.select("Crate", "lamp");
        await scene.deleteSelected();
        await expect(scene.row("Crate")).toHaveCount(0);
        await expect(scene.row("lamp")).toHaveCount(0);
        await scene.tool("undo").click();
        await expect(scene.row("Crate")).toBeVisible();
        await expect(scene.row("lamp")).toBeVisible();
      },
      expected: kTidied
    },
    {
      id: "light",
      title: "turn the sun into a spot light and narrow its cone",
      play: async(scene) => {
        await scene.row("Sun").click();
        const light = scene.component("Light");
        await selectField(light, "Kind").selectOption({ label: "Spot" });
        await scene.showMore("Light");
        await expect(light.locator("jolly-number[label=\"Angle\"]")).toBeVisible();
        await scene.editNumber("Light", "Angle", "30");
      },
      expected: kLit
    },
    {
      id: "reload",
      title: "the room and its lamp survive a page reload",
      play: (scene) => scene.reload(),
      expected: kLit
    },
    {
      id: "round-trip",
      title: "export, wipe the offline data and import the room back",
      play: async(scene) => {
        const download = await scene.archives.exportArchive();
        const archivePath = await download.path();

        await scene.archives.resetOfflineData();
        await scene.archives.importArchive(archivePath);
      },
      expected: kLit
    }
  ]
}).register();
