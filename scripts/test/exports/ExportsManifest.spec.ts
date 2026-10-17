// Import Node.js Dependencies
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { ExportsManifest } from "../../exports/ExportsManifest.ts";
import {
  WorkspaceProject,
  type PackageManifest
} from "../../workspace/WorkspaceProject.ts";

// CONSTANTS
const kDirectory = path.join(import.meta.dirname, "..", "fixtures", "exports");
const kDistTarget = {
  types: "./dist/index.d.ts",
  default: "./dist/index.js"
};

interface ManifestCase {
  title: string;
  manifest: Omit<PackageManifest, "name">;
  expected: string[];
}

const kCases: ManifestCase[] = [
  {
    title: "accepts a source target and a dist target backed by a source file",
    manifest: {
      exports: {
        ".": "./src/index.ts",
        "./math": kDistTarget
      }
    },
    expected: []
  },
  {
    title: "lets a private package omit exports",
    manifest: {
      private: true
    },
    expected: []
  },
  {
    title: "requires exports on a published package",
    manifest: {},
    expected: ["pkg: published packages must declare \"exports\""]
  },
  {
    title: "rejects main and types next to exports without a root entry",
    manifest: {
      main: "./dist/index.js",
      exports: {
        "./math": "./src/index.ts"
      }
    },
    expected: [
      "pkg: drop \"main\" and \"types\" in favor of \"exports\"",
      "pkg: \"exports\" must declare \".\""
    ]
  },
  {
    title: "rejects subpaths that are relative-less, capitalized or carry an extension",
    manifest: {
      exports: {
        ".": "./src/index.ts",
        math: "./src/index.ts",
        "./Math.js": "./src/index.ts"
      }
    },
    expected: [
      "pkg: \"math\" must start with \"./\"",
      "pkg: \"./Math.js\" must use lowercase names with no extension or wildcard"
    ]
  },
  {
    title: "requires a string target to be an existing source file",
    manifest: {
      exports: {
        ".": "./dist/index.js",
        "./missing": "./src/missing.ts"
      }
    },
    expected: [
      "pkg: \".\" string target must be an existing ./src/*.ts file",
      "pkg: \"./missing\" string target must be an existing ./src/*.ts file"
    ]
  },
  {
    title: "rejects conditional targets with extra conditions",
    manifest: {
      exports: {
        ".": {
          ...kDistTarget,
          import: "./dist/index.js"
        }
      }
    },
    expected: ["pkg: \".\" target must be { types, default }"]
  },
  {
    title: "requires types to come before default",
    manifest: {
      exports: {
        ".": {
          default: "./dist/index.js",
          types: "./dist/index.d.ts"
        }
      }
    },
    expected: ["pkg: \".\" must list \"types\" before \"default\""]
  },
  {
    title: "requires types to mirror the default target",
    manifest: {
      exports: {
        ".": {
          types: "./dist/types.d.ts",
          default: "./dist/index.js"
        }
      }
    },
    expected: ["pkg: \".\" types must mirror its default target"]
  },
  {
    title: "requires a source file behind a dist target",
    manifest: {
      exports: {
        ".": {
          types: "./dist/missing.d.ts",
          default: "./dist/missing.js"
        }
      }
    },
    expected: ["pkg: \".\" has no source file for ./dist/missing.js"]
  }
];

describe("ExportsManifest.problems", () => {
  for (const { title, manifest, expected } of kCases) {
    it(title, () => {
      const project = new WorkspaceProject(kDirectory, {
        name: "pkg",
        ...manifest
      });

      assert.deepEqual([...new ExportsManifest(project).problems()], expected);
    });
  }
});
