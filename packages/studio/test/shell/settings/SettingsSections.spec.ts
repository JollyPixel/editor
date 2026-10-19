// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { definePreferences } from "@jolly-pixel/editor.host/preferences";
import type { TreeNode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetKindSet } from "../../../src/catalog/AssetKindSet.ts";
import type { EditorScopes } from "../../../src/editors/ProjectManifest.ts";
import { SHELL_PREFERENCES } from "../../../src/preferences/PreferenceScopes.ts";
import { STUDIO_PREFERENCES } from "../../../src/preferences/studioScope.ts";
import type { ProjectReply } from "../../../src/project/routes.ts";
import {
  SettingsSections,
  type SettingsSection
} from "../../../src/shell/settings/SettingsSections.ts";

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
const kEveryRight: ProjectReply = {
  canExport: true,
  canReadSettings: true,
  canEditSettings: true,
  canAudit: true,
  canManageAccess: true
};

type Outline = (string | Record<string, Outline>)[];

function outline(
  nodes: readonly TreeNode<SettingsSection>[]
): Outline {
  return nodes.map((node) => (
    node.children === undefined ?
      node.id :
      { [node.id]: outline(node.children) }
  ));
}

function sections(
  project: ProjectReply | null = null,
  editors: EditorScopes[] = [kVoxelMapEditor, kPixelArtEditor]
): SettingsSections {
  return new SettingsSections({
    signedIn: true,
    shellScopes: SHELL_PREFERENCES,
    editors,
    kindPackages: [
      {
        name: "@jolly-pixel/asset.voxel-map",
        kinds: ["voxelmap", "blockset"]
      }
    ],
    kinds: kKinds,
    project
  });
}

describe("SettingsSections", () => {
  test("nests editor pages under You, each scope under the editor declaring it", () => {
    const settings = sections();

    assert.deepEqual(outline(settings.nodes), [
      {
        you: [
          "profile",
          "appearance",
          "camera",
          {
            editors: ["editor:voxel-map", "editor:pixel-art"]
          }
        ]
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
    const voxelMap = sections(null, [kVoxelMapEditor]).find("editor:voxel-map");

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

  test("makes every heading fold-only and leaves headings out of the sections", () => {
    const settings = sections(kEveryRight);

    assert.deepEqual(
      [...settings.headings].sort(),
      ["assets", "editors", "project", "you"]
    );
    for (const id of settings.headings) {
      assert.equal(settings.find(id), undefined);
    }
    const branches = settings.nodes.flatMap(
      (node) => [node, ...(node.children ?? [])]
    ).filter((node) => node.children !== undefined);
    assert.equal(branches.length, 4);
    assert.ok(branches.every((node) => node.selectable === false));
  });

  test("has no profile without an account", () => {
    const settings = new SettingsSections({
      signedIn: false,
      shellScopes: [STUDIO_PREFERENCES]
    });

    assert.equal(settings.first?.id, "appearance");
    assert.equal(settings.find("profile"), undefined);
  });

  test("shows Share links under You and the Project sections the role reads", () => {
    assert.deepEqual(outline(sections(kEveryRight).nodes)[1], {
      project: [
        "project-general",
        "project-access",
        "project-audit",
        {
          assets: ["kind-package:@jolly-pixel/asset.voxel-map"]
        }
      ]
    });
    const kindPackage = sections(kEveryRight)
      .find("kind-package:@jolly-pixel/asset.voxel-map");
    assert.ok(kindPackage?.kind === "kind-package");
    assert.equal(kindPackage.label, "Voxel map, Blockset");
    assert.equal(kindPackage.icon, "kind:voxelmap");

    const reader = sections({
      ...kEveryRight,
      canReadSettings: false,
      canAudit: false,
      canManageAccess: false
    });
    assert.deepEqual(reader.ids, [
      "profile",
      "appearance",
      "camera",
      "share-links",
      "editor:voxel-map",
      "editor:pixel-art"
    ]);
  });
});
