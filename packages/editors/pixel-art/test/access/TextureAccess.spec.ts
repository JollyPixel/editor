// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Grants } from "@jolly-pixel/network/client";
import type {
  Mode,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  TextureAccess,
  type UvAccess
} from "../../src/access/TextureAccess.ts";
import {
  PIXEL_ART_CAPABILITIES,
  type PixelArtCapability
} from "../../src/access/PixelArtAccess.ts";

// CONSTANTS
const kFull = PIXEL_ART_CAPABILITIES.full;

function grants(
  ...capabilities: PixelArtCapability[]
): Grants<PixelArtCapability> {
  return new Grants(capabilities);
}

function gates(
  access: TextureAccess
) {
  return {
    uvMode: access.uvMode,
    uvStructure: access.uvStructure,
    regionVisibility: access.regionVisibility,
    fillClip: access.fillClip
  };
}

describe("TextureAccess.isUvAccess", () => {
  test("accepts the three levels and nothing else", () => {
    for (const value of ["edit", "view", "none"]) {
      assert.equal(TextureAccess.isUvAccess(value), true);
    }
    for (const value of ["", "EDIT", "uv", "toString"]) {
      assert.equal(TextureAccess.isUvAccess(value), false);
    }
  });
});

describe("TextureAccess UV gates", () => {
  const cases: {
    title: string;
    uvAccess: UvAccess;
    grants: Grants<PixelArtCapability>;
    expected: ReturnType<typeof gates>;
  }[] = [
    {
      title: "full rights with editable UVs open every UV control",
      uvAccess: "edit",
      grants: kFull,
      expected: {
        uvMode: true,
        uvStructure: true,
        regionVisibility: true,
        fillClip: true
      }
    },
    {
      title: "view-only UVs keep visibility and the fill clip without UV mode",
      uvAccess: "view",
      grants: kFull,
      expected: {
        uvMode: false,
        uvStructure: false,
        regionVisibility: true,
        fillClip: true
      }
    },
    {
      title: "disabled UVs hide every UV control",
      uvAccess: "none",
      grants: kFull,
      expected: {
        uvMode: false,
        uvStructure: false,
        regionVisibility: false,
        fillClip: false
      }
    },
    {
      title: "a texture without the uv grant can only view editable UVs",
      uvAccess: "edit",
      grants: grants("pixels", "uvStructure"),
      expected: {
        uvMode: false,
        uvStructure: false,
        regionVisibility: true,
        fillClip: true
      }
    },
    {
      title: "a missing uv grant never re-enables disabled UVs",
      uvAccess: "none",
      grants: grants("pixels"),
      expected: {
        uvMode: false,
        uvStructure: false,
        regionVisibility: false,
        fillClip: false
      }
    },
    {
      title: "moving regions without the uvStructure grant hides create and delete",
      uvAccess: "edit",
      grants: grants("uv"),
      expected: {
        uvMode: true,
        uvStructure: false,
        regionVisibility: true,
        fillClip: true
      }
    }
  ];

  for (const { title, uvAccess, grants: granted, expected } of cases) {
    test(title, () => {
      assert.deepEqual(gates(new TextureAccess(uvAccess, granted)), expected);
    });
  }
});

describe("TextureAccess document gates", () => {
  test("full rights unlock pixels, palette and normal map", () => {
    const access = new TextureAccess("edit", kFull);

    assert.equal(access.pixels, true);
    assert.equal(access.palette, true);
    assert.equal(access.normalMap, true);
    assert.equal(access.viewOnly, false);
  });

  test("each capability follows its own grant", () => {
    const access = new TextureAccess("edit", grants("palette"));

    assert.equal(access.pixels, false);
    assert.equal(access.palette, true);
    assert.equal(access.normalMap, false);
    assert.equal(access.viewOnly, false);
  });

  test("no grant at all is view only", () => {
    const access = new TextureAccess("edit", PIXEL_ART_CAPABILITIES.none);

    assert.equal(access.viewOnly, true);
    assert.equal(access.pixels, false);
  });
});

describe("TextureAccess.constrain", () => {
  test("falls back to paint only for UV mode without UV editing", () => {
    const modes: Mode[] = ["uv", "fill", "move", "select"];

    assert.deepEqual(
      modes.map((mode) => new TextureAccess("edit", kFull).constrain(mode)),
      modes
    );
    assert.deepEqual(
      modes.map((mode) => new TextureAccess("view", kFull).constrain(mode)),
      ["paint", "fill", "move", "select"]
    );
  });
});

describe("TextureAccess.applyTo", () => {
  function makeCanvas(
    mode: Mode
  ) {
    return {
      mode,
      pixelsLocked: false,
      tools: {
        fill: {
          uvClip: true
        }
      }
    };
  }

  test("leaves UV mode, locks pixels and drops the fill clip when UVs are disabled", () => {
    const canvas = makeCanvas("uv");

    new TextureAccess("none", grants("uv")).applyTo(
      canvas as unknown as PixelArtCanvas
    );

    assert.deepEqual(canvas, {
      mode: "paint",
      pixelsLocked: true,
      tools: {
        fill: {
          uvClip: false
        }
      }
    });
  });

  test("keeps the canvas as is when everything is granted", () => {
    const canvas = makeCanvas("uv");

    new TextureAccess("edit", kFull).applyTo(
      canvas as unknown as PixelArtCanvas
    );

    assert.deepEqual(canvas, makeCanvas("uv"));
  });
});
