// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  DEFAULT_ICON_VIEW_BOX,
  getIcon,
  iconTone,
  iconViewBox
} from "@jolly-pixel/ui";

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
  convertsFrom: []
};
const kMapEditor = {
  name: "voxel-map",
  kinds: ["voxelmap"]
};

describe("EditorRegistry", () => {
  test("resolves the editor that opens a kind", () => {
    const registry = new EditorRegistry().registerEditor(kMapEditor);

    assert.deepEqual(registry.findEditor("voxelmap"), kMapEditor);
    assert.equal(registry.findEditor("texture"), undefined);
  });

  test("builds the page url with the encoded target", () => {
    const registry = new EditorRegistry().registerEditor(kMapEditor);

    assert.equal(
      registry.pageUrl("voxelmap", "map a&b"),
      "editors/voxel-map/?target=map+a%26b"
    );
    assert.equal(registry.pageUrl("texture", "map"), undefined);
  });

  test("builds a page url that stays under the shell's sub-path", () => {
    const registry = new EditorRegistry().registerEditor(kMapEditor);
    const url = registry.pageUrl("voxelmap", "map");
    assert.ok(url);

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
    const icon = registry.kindSet().kindIcon("voxelmap");

    assert.equal(icon, "kind:voxelmap");
    assert.notEqual(getIcon(icon), null);
    assert.equal(iconTone(icon), "lime");
    assert.equal(iconViewBox(icon), DEFAULT_ICON_VIEW_BOX);
  });

  test("registers an illustrated kind icon on its own grid", () => {
    const registry = new EditorRegistry().registerKind({
      kind: "blockset",
      label: "Blockset",
      extension: ".blockset",
      icon: {
        svg: "<rect width=\"64\" height=\"64\" fill=\"#ffc93c\" />",
        viewBox: "0 0 64 64"
      },
      convertsFrom: []
    });
    const icon = registry.kindSet().kindIcon("blockset");

    assert.equal(iconViewBox(icon), "0 0 64 64");
    assert.equal(iconTone(icon), null);
  });

  test("snapshots the registered kinds in registration order", () => {
    const registry = new EditorRegistry()
      .registerKind(kMapKind)
      .registerKind({
        kind: "pixelart",
        label: "Pixel art",
        extension: ".pixelart",
        convertsFrom: [".png"]
      });

    assert.deepEqual(registry.kindSet().entries, [
      {
        kind: "voxelmap",
        label: "Voxel map",
        extension: ".voxelmap.json",
        icon: "kind:voxelmap",
        convertsFrom: []
      },
      {
        kind: "pixelart",
        label: "Pixel art",
        extension: ".pixelart",
        icon: undefined,
        convertsFrom: [".png"]
      }
    ]);
  });

  test("snapshots the kinds an editor opens", () => {
    const registry = new EditorRegistry().registerEditor(kMapEditor);
    const kinds = registry.kindSet();

    assert.equal(kinds.kindDetail("voxelmap"), undefined);
    assert.equal(kinds.kindDetail("texture"), "no editor");
  });

  test("a snapshot ignores later registrations", () => {
    const registry = new EditorRegistry();
    const kinds = registry.kindSet();
    registry.registerKind(kMapKind).registerEditor(kMapEditor);

    assert.equal(kinds.has("voxelmap"), false);
    assert.equal(kinds.kindDetail("voxelmap"), "no editor");
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
        extension: ".voxelmap.json",
        icon: {
          svg: "",
          tone: "mauve"
        },
        convertsFrom: []
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
    assert.equal(registry.findEditor("heightmap"), undefined);
  });

  test("copies the registered editor", () => {
    const kinds = ["voxelmap"];
    const registry = new EditorRegistry().registerEditor({
      name: "voxel-map",
      kinds
    });
    kinds.push("voxelmodel");

    assert.equal(registry.findEditor("voxelmodel"), undefined);
    assert.deepEqual(registry.findEditor("voxelmap")?.kinds, ["voxelmap"]);
  });
});
