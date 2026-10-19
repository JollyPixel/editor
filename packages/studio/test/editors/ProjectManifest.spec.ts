// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PROJECT_MANIFEST_FILE,
  ProjectManifest
} from "../../src/editors/ProjectManifest.ts";

// CONSTANTS
const kEditors = [
  {
    name: "voxel-map",
    kinds: ["voxelmap"],
    preferences: [],
    sharedPreferences: []
  }
];
const kKinds = [
  {
    kind: "voxelmap",
    label: "Voxel map",
    extension: ".voxelmap.json",
    icon: {
      svg: "<path/>",
      tone: "green"
    },
    convertsFrom: []
  },
  {
    kind: "blockset",
    label: "Blockset",
    extension: ".blockset.json",
    convertsFrom: [".png"]
  }
];
const kKindPackages = [
  {
    name: "@jolly-pixel/asset.voxel-map",
    kinds: ["voxelmap", "blockset"]
  }
];

describe("ProjectManifest", () => {
  test("parses back the JSON it serializes to", () => {
    const manifest = ProjectManifest.parse(JSON.parse(JSON.stringify(
      new ProjectManifest({
        editors: kEditors,
        kinds: kKinds,
        kindPackages: kKindPackages
      })
    )));

    assert.deepEqual(manifest.editors, kEditors);
    assert.deepEqual(manifest.kinds, kKinds);
    assert.deepEqual(manifest.kindPackages, kKindPackages);
  });

  test("drops the properties a descriptor does not declare", () => {
    const manifest = ProjectManifest.parse({
      editors: [
        {
          ...kEditors[0],
          dist: "/secret"
        }
      ],
      kinds: [
        {
          ...kKinds[1],
          handler: "code"
        }
      ],
      kindPackages: []
    });

    assert.deepEqual(manifest.editors, kEditors);
    assert.deepEqual(manifest.kinds, [kKinds[1]]);
  });

  test("lists the declared and shared scopes of every editor, skipping invalid ones", () => {
    const manifest = new ProjectManifest({
      editors: [
        {
          name: "voxel-map",
          kinds: ["voxelmap"],
          preferences: [
            {
              name: "voxel-map",
              label: "Voxel map",
              fields: {
                grid: {
                  type: "boolean",
                  label: "Grid",
                  default: true
                }
              }
            },
            {
              name: "Not Kebab"
            }
          ],
          sharedPreferences: [
            {
              name: "pixel-art",
              label: "Pixel art",
              fields: {
                palette: {
                  type: "boolean",
                  label: "Palette",
                  default: false
                }
              }
            }
          ]
        }
      ],
      kinds: [],
      kindPackages: []
    });
    const [voxelMap] = manifest.editorScopes();

    assert.deepEqual(voxelMap.scopes.map((scope) => scope.name), ["voxel-map"]);
    assert.deepEqual(voxelMap.shared.map((scope) => scope.name), ["pixel-art"]);
    assert.deepEqual(
      [...manifest.preferences()].map((scope) => scope.name),
      ["voxel-map", "pixel-art"]
    );
  });

  test("names the manifest file it rejects", () => {
    const invalid: unknown[] = [
      null,
      { editors: kEditors },
      {
        editors: [{ name: "pixel-art", kinds: "pixelart" }],
        kinds: []
      },
      {
        editors: [],
        kinds: [{ kind: "voxelmap", label: "Voxel map" }]
      },
      {
        editors: [],
        kinds: [{ ...kKinds[1], icon: { tone: "green" } }]
      }
    ];

    for (const value of invalid) {
      assert.throws(
        () => ProjectManifest.parse(value),
        (error) => error instanceof TypeError &&
          error.message.startsWith(`"${PROJECT_MANIFEST_FILE}" is invalid:`)
      );
    }
  });
});
