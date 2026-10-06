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
    kinds: ["voxelmap"]
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
    }
  },
  {
    kind: "blockset",
    label: "Blockset",
    extension: ".blockset.json"
  }
];

describe("ProjectManifest", () => {
  test("parses back the JSON it serializes to", () => {
    const manifest = ProjectManifest.parse(JSON.parse(JSON.stringify(
      new ProjectManifest({
        editors: kEditors,
        kinds: kKinds
      })
    )));

    assert.deepEqual(manifest.editors, kEditors);
    assert.deepEqual(manifest.kinds, kKinds);
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
      ]
    });

    assert.deepEqual(manifest.editors, kEditors);
    assert.deepEqual(manifest.kinds, [kKinds[1]]);
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
