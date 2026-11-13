// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { EditorRegistry } from "../../src/editors/EditorRegistry.ts";

// CONSTANTS
const kMapKind = {
  kind: "voxelmap",
  label: "Voxel map",
  extension: ".voxelmap.json",
  icon: {
    svg: "<path d=\"M3 6h18\" />",
    tone: "lime"
  },
  convertsFrom: [],
  extensions: [".voxelmap.json"]
};
const kOptions = {
  maxContentBytes: 1024
};
const kMapEditor = {
  name: "voxel-map",
  package: "@jolly-pixel/editor.voxel-map",
  kinds: ["voxelmap"]
};

describe("EditorRegistry", () => {
  test("resolves the editor that opens a kind", () => {
    const registry = new EditorRegistry(kOptions).registerEditor(kMapEditor);

    assert.deepEqual(registry.findEditor("voxelmap"), kMapEditor);
    assert.equal(registry.findEditor("texture"), undefined);
  });

  test("builds the page url with the encoded target", () => {
    const registry = new EditorRegistry(kOptions);

    assert.equal(
      registry.pageUrl("voxel-map", "map a&b"),
      "editors/voxel-map/?target=map+a%26b"
    );
  });

  test("builds a page url that stays under the shell's sub-path", () => {
    const registry = new EditorRegistry(kOptions);
    const url = registry.pageUrl("voxel-map", "map");

    assert.equal(
      new URL(url, "https://example.com/studio/").pathname,
      "/studio/editors/voxel-map/"
    );
    assert.equal(
      new URL(url, "https://example.com/studio/index.html").pathname,
      "/studio/editors/voxel-map/"
    );
  });

  test("puts the registry query before the target", () => {
    const registry = new EditorRegistry({
      query: {
        offline: "studio"
      },
      prefix: "/pages/",
      maxContentBytes: 1024
    });

    assert.equal(
      registry.pageUrl("voxel-map", "map"),
      "/pages/voxel-map/?offline=studio&target=map"
    );
  });

  test("opens the preview page on the same back-end as the editor pages", () => {
    assert.equal(new EditorRegistry(kOptions).previewUrl(), "preview/index.html");
    assert.equal(
      new EditorRegistry({
        query: {
          offline: "studio"
        },
        maxContentBytes: 1024
      }).previewUrl(),
      "preview/index.html?offline=studio"
    );
  });

  test("snapshots the registered kinds in registration order", () => {
    const registry = new EditorRegistry(kOptions)
      .registerKind(kMapKind)
      .registerKind({
        kind: "pixelart",
        label: "Pixel art",
        extension: ".pixelart",
        convertsFrom: [".png"],
        extensions: [".pixelart"],
        preview: "server"
      })
      .registerKind({
        kind: "font",
        label: "Font",
        extension: ".typeface.json",
        creatable: false,
        convertsFrom: [".ttf"],
        extensions: [".typeface.json"],
        maxContentBytes: 2048
      });

    assert.equal(registry.kindSet().maxContentBytes, kOptions.maxContentBytes);
    assert.deepEqual(registry.kindSet().entries, [
      {
        kind: "voxelmap",
        label: "Voxel map",
        extension: ".voxelmap.json",
        icon: "kind:voxelmap",
        creatable: undefined,
        convertsFrom: [],
        extensions: [".voxelmap.json"],
        maxContentBytes: undefined,
        preview: undefined,
        capabilities: undefined
      },
      {
        kind: "pixelart",
        label: "Pixel art",
        extension: ".pixelart",
        icon: undefined,
        creatable: undefined,
        convertsFrom: [".png"],
        extensions: [".pixelart"],
        maxContentBytes: undefined,
        preview: "server",
        capabilities: undefined
      },
      {
        kind: "font",
        label: "Font",
        extension: ".typeface.json",
        icon: undefined,
        creatable: false,
        convertsFrom: [".ttf"],
        extensions: [".typeface.json"],
        maxContentBytes: 2048,
        preview: undefined,
        capabilities: undefined
      }
    ]);
  });

  test("snapshots the kinds an editor opens", () => {
    const registry = new EditorRegistry(kOptions).registerEditor(kMapEditor);
    const kinds = registry.kindSet();

    assert.equal(kinds.kindDetail("voxelmap"), undefined);
    assert.equal(kinds.kindDetail("texture"), "no editor");
  });

  test("a snapshot ignores later registrations", () => {
    const registry = new EditorRegistry(kOptions);
    const kinds = registry.kindSet();
    registry.registerKind(kMapKind).registerEditor(kMapEditor);

    assert.equal(kinds.has("voxelmap"), false);
    assert.equal(kinds.kindDetail("voxelmap"), "no editor");
  });

  test("rejects a kind registered twice", () => {
    const registry = new EditorRegistry(kOptions).registerKind(kMapKind);

    assert.throws(() => registry.registerKind(kMapKind), TypeError);
  });

  test("rejects a kind opened by two editors", () => {
    const registry = new EditorRegistry(kOptions).registerEditor(kMapEditor);

    assert.throws(
      () => registry.registerEditor({
        name: "terrain",
        package: "@jolly-pixel/editor.terrain",
        kinds: ["heightmap", "voxelmap"]
      }),
      /already opens in editor "voxel-map"/
    );
    assert.equal(registry.findEditor("heightmap"), undefined);
  });

  test("copies the registered editor", () => {
    const kinds = ["voxelmap"];
    const registry = new EditorRegistry(kOptions).registerEditor({
      name: "voxel-map",
      package: "@jolly-pixel/editor.voxel-map",
      kinds
    });
    kinds.push("voxelmodel");

    assert.equal(registry.findEditor("voxelmodel"), undefined);
    assert.deepEqual(registry.findEditor("voxelmap")?.kinds, ["voxelmap"]);
  });
});
