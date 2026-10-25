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
import { registerKindIcon } from "#src/ui/registerKindIcon.ts";

describe("registerKindIcon", () => {
  test("registers the icon of a kind under its own name", () => {
    const icon = registerKindIcon({
      kind: "voxelmap",
      label: "Voxel map",
      extension: ".voxelmap.json",
      icon: {
        svg: "<path d=\"M3 6h18\" />",
        tone: "lime"
      }
    });

    assert.equal(icon, "kind:voxelmap");
    assert.notEqual(getIcon(icon), null);
    assert.equal(iconTone(icon), "lime");
    assert.equal(iconViewBox(icon), DEFAULT_ICON_VIEW_BOX);
  });

  test("registers an illustrated kind icon on its own grid", () => {
    const icon = registerKindIcon({
      kind: "blockset",
      label: "Blockset",
      extension: ".blockset",
      icon: {
        svg: "<rect width=\"64\" height=\"64\" fill=\"#ffc93c\" />",
        viewBox: "0 0 64 64"
      }
    });

    assert.ok(icon !== undefined);
    assert.equal(iconViewBox(icon), "0 0 64 64");
    assert.equal(iconTone(icon), null);
  });

  test("returns no icon for a kind without one", () => {
    assert.equal(registerKindIcon({
      kind: "pixelart",
      label: "Pixel art",
      extension: ".pixelart"
    }), undefined);
  });

  test("rejects an unknown icon tone", () => {
    assert.throws(
      () => registerKindIcon({
        kind: "voxelmap",
        label: "Voxel map",
        extension: ".voxelmap.json",
        icon: {
          svg: "",
          tone: "mauve"
        }
      }),
      /unknown icon tone "mauve"/
    );
  });
});
