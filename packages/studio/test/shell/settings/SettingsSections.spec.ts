// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { definePreferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { AssetKindSet } from "../../../src/catalog/AssetKindSet.ts";
import type { EditorScopes } from "../../../shared/ProjectManifest.ts";
import { SHELL_PREFERENCES } from "../../../shared/PreferenceScopes.ts";
import { STUDIO_PREFERENCES } from "../../../shared/studioScope.ts";
import { ProjectRights } from "../../../shared/ProjectRights.ts";
import { SettingsSections } from "../../../src/shell/settings/SettingsSections.ts";

// CONSTANTS
const kPixelArt = definePreferences({
  name: "pixel-art",
  label: "Pixel art",
  fields: {
    grid: {
      type: "boolean",
      label: "Grid",
      default: false
    }
  }
});
const kPixelArtKeys = definePreferences({
  name: "pixel-art-keybindings",
  label: "Pixel art",
  fields: {
    rotate: {
      type: "chord",
      label: "Rotate",
      default: ["r"]
    }
  }
});
const kVoxelMap = definePreferences({
  name: "voxel-map",
  label: "Voxel map",
  fields: {
    lighting: {
      type: "boolean",
      label: "Lighting",
      default: true
    }
  }
});
const kVoxelMapEditor: EditorScopes = {
  name: "voxel-map",
  kinds: ["voxelmap"],
  scopes: [kVoxelMap],
  shared: [kPixelArt, kPixelArtKeys]
};
const kPixelArtEditor: EditorScopes = {
  name: "pixel-art",
  kinds: ["pixelart"],
  scopes: [kPixelArt, kPixelArtKeys],
  shared: []
};
const kKinds = new AssetKindSet({
  kinds: [
    {
      kind: "voxelmap",
      label: "Voxel map",
      extension: ".voxelmap.json",
      icon: "kind:voxelmap"
    },
    {
      kind: "pixelart",
      label: "Pixel art",
      extension: ".pixelart.json",
      icon: "kind:pixelart"
    },
    {
      kind: "blockset",
      label: "Blockset",
      extension: ".blockset.json"
    }
  ],
  editable: ["voxelmap", "pixelart"]
});
const kEveryRight = new ProjectRights({
  share: true,
  export: true,
  readSettings: true,
  editSettings: true,
  audit: true,
  manageAccess: true
});

function outline(
  settings: SettingsSections
): Record<string, string[]>[] {
  return settings.blocks.map((block) => Object.fromEntries(block.map(
    (group) => [group.id, group.sections.map((section) => section.id)]
  )));
}

function sections(
  rights = ProjectRights.NONE,
  editors: EditorScopes[] = [kVoxelMapEditor, kPixelArtEditor]
): SettingsSections {
  return new SettingsSections({
    user: {
      online: true,
      rights
    },
    shellScopes: SHELL_PREFERENCES,
    editors,
    kindPackages: [
      {
        name: "@jolly-pixel/asset.voxel-map",
        kinds: ["voxelmap", "blockset"]
      }
    ],
    kinds: kKinds
  });
}

describe("SettingsSections", () => {
  test("groups editor pages after You, each scope under the editor declaring it", () => {
    const settings = sections();

    assert.deepEqual(outline(settings), [
      {
        you: ["profile", "appearance", "camera", "preferences-file", "share-links"],
        editors: ["editor:voxel-map", "editor:pixel-art"]
      }
    ]);
    const pixelArt = settings.find("editor:pixel-art");
    assert.ok(pixelArt?.kind === "preferences");
    assert.equal(pixelArt.label, "Pixel art");
    assert.equal(pixelArt.icon, "kind:pixelart");
    assert.deepEqual(pixelArt.forms, [kPixelArt]);
    assert.deepEqual(pixelArt.keyBindings, [kPixelArtKeys]);
    const voxelMap = settings.find("editor:voxel-map");
    assert.ok(voxelMap?.kind === "preferences");
    assert.deepEqual(voxelMap.forms, [kVoxelMap]);
    assert.deepEqual(voxelMap.keyBindings, []);
  });

  test("shows a shared scope under the first editor reading it when no editor declares it", () => {
    const voxelMap = sections(ProjectRights.NONE, [kVoxelMapEditor]).find("editor:voxel-map");

    assert.ok(voxelMap?.kind === "preferences");
    assert.deepEqual(voxelMap.forms, [kVoxelMap, kPixelArt]);
    assert.deepEqual(voxelMap.keyBindings, [kPixelArtKeys]);
  });

  test("gives the studio and host scopes to Appearance", () => {
    const appearance = sections().find("appearance");

    assert.ok(appearance?.kind === "preferences");
    assert.deepEqual(
      appearance.forms.map((scope) => scope.name),
      ["studio", "runtime", "lantern"]
    );
  });

  test("leaves out a group with no section", () => {
    const settings = sections(ProjectRights.NONE, []);

    assert.deepEqual(
      outline(settings).map((block) => Object.keys(block)),
      [["you"]]
    );
  });

  test("has no profile without an account", () => {
    const settings = new SettingsSections({
      user: {
        online: false,
        rights: ProjectRights.NONE
      },
      shellScopes: [STUDIO_PREFERENCES]
    });

    assert.equal(settings.first?.id, "appearance");
    assert.equal(settings.find("profile"), undefined);
  });

  test("shows Share links under You and the Project sections the role reads in a block of their own", () => {
    const [{ you }, { project, assets }] = outline(sections(kEveryRight));
    assert.equal(you.at(-1), "share-links");
    assert.deepEqual(project, [
      "project-general",
      "project-access",
      "project-audit"
    ]);
    assert.deepEqual(assets, ["kind-package:@jolly-pixel/asset.voxel-map"]);
    const kindPackage = sections(kEveryRight)
      .find("kind-package:@jolly-pixel/asset.voxel-map");
    assert.ok(kindPackage?.kind === "kind-package");
    assert.equal(kindPackage.label, "Voxel map, Blockset");
    assert.equal(kindPackage.icon, "kind:voxelmap");

    const reader = sections(new ProjectRights({
      ...kEveryRight.toJSON(),
      readSettings: false,
      audit: false,
      manageAccess: false
    }));
    assert.deepEqual(reader.ids, [
      "profile",
      "appearance",
      "camera",
      "preferences-file",
      "share-links",
      "editor:voxel-map",
      "editor:pixel-art"
    ]);
  });
});
