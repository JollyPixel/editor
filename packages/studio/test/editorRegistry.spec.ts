// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  getIcon,
  iconTone
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditorRegistry } from "../src/editors/EditorRegistry.ts";

// CONSTANTS
const kMapKind = {
  kind: "voxelmap",
  label: "Voxel map",
  icon: {
    svg: "<path d=\"M3 6h18\" />",
    tone: "lime"
  }
};
const kMapEditor = {
  name: "voxel-map",
  kinds: ["voxelmap"]
};

describe("EditorRegistry", () => {
  test("resolves the editor that opens a kind", () => {
    const registry = new EditorRegistry().registerEditor(kMapEditor);

    assert.deepEqual(registry.editorFor("voxelmap"), kMapEditor);
    assert.equal(registry.editorFor("texture"), undefined);
  });

  test("builds the page url with the encoded target", () => {
    const registry = new EditorRegistry().registerEditor(kMapEditor);

    assert.equal(
      registry.pageUrl("voxelmap", "map a&b"),
      "/editors/voxel-map/?target=map+a%26b"
    );
    assert.equal(registry.pageUrl("texture", "map"), undefined);
  });

  test("puts the registry query before the target", () => {
    const registry = new EditorRegistry({
      query: {
        offline: "",
        workspace: "studio"
      },
      prefix: "/pages/"
    }).registerEditor(kMapEditor);

    assert.equal(
      registry.pageUrl("voxelmap", "map"),
      "/pages/voxel-map/?offline=&workspace=studio&target=map"
    );
  });

  test("registers the icon of a kind under its own name", () => {
    const registry = new EditorRegistry().registerKind(kMapKind);
    const icon = registry.iconFor("voxelmap");

    assert.equal(icon, "kind:voxelmap");
    assert.notEqual(getIcon(icon), null);
    assert.equal(iconTone(icon), "lime");
  });

  test("falls back to the file icon", () => {
    const registry = new EditorRegistry().registerKind({
      kind: "texture",
      label: "Texture"
    });

    assert.equal(registry.iconFor("texture"), "file");
    assert.equal(registry.iconFor("unknown"), "file");
  });

  test("rejects a kind registered twice", () => {
    const registry = new EditorRegistry().registerKind(kMapKind);

    assert.throws(() => registry.registerKind(kMapKind), TypeError);
  });

  test("rejects an unknown icon tone", () => {
    assert.throws(
      () => new EditorRegistry().registerKind({
        kind: "voxelmap",
        label: "Voxel map",
        icon: {
          svg: "",
          tone: "mauve"
        }
      }),
      /unknown icon tone "mauve"/
    );
  });

  test("rejects a kind opened by two editors", () => {
    const registry = new EditorRegistry().registerEditor(kMapEditor);

    assert.throws(
      () => registry.registerEditor({
        name: "terrain",
        kinds: ["heightmap", "voxelmap"]
      }),
      /already opens in editor "voxel-map"/
    );
    assert.equal(registry.editorFor("heightmap"), undefined);
  });

  test("copies the registered editor", () => {
    const kinds = ["voxelmap"];
    const registry = new EditorRegistry().registerEditor({
      name: "voxel-map",
      kinds
    });
    kinds.push("voxelmodel");

    assert.equal(registry.editorFor("voxelmodel"), undefined);
    assert.deepEqual(registry.editorFor("voxelmap")?.kinds, ["voxelmap"]);
  });
});
