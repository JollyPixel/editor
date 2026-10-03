// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  DEFAULT_NORMAL_MAP_SETTINGS,
  IslandMap,
  NormalMap,
  NormalMapConfig,
  type NormalMapSettings,
  type NormalMapZone
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  NormalMapTarget,
  type NormalMapTargetDocument
} from "#src/normal/NormalMapTarget.ts";

// CONSTANTS
const kSize = {
  x: 8,
  y: 8
};

class FakeDocument implements NormalMapTargetDocument {
  normalMap: NormalMapConfig | null = NormalMapConfig.create();
  commits = 0;
  readonly uv: { selectedRegionId: string | null; } = {
    selectedRegionId: null
  };
  readonly normals = new NormalMap({
    size: () => kSize,
    pixels: () => new Uint8ClampedArray(kSize.x * kSize.y * 4),
    islands: () => IslandMap.fromFaces(kSize, []),
    config: () => this.normalMap,
    connect: () => () => undefined
  });

  patchNormalMapDefaults(
    patch: Partial<NormalMapSettings>
  ): void {
    this.normalMap = this.normalMap?.withDefaults(patch) ?? null;
    this.commits++;
  }

  setNormalMapZone(
    zone: NormalMapZone
  ): void {
    this.normalMap = this.normalMap?.withZone(zone) ?? null;
    this.commits++;
  }
}

function createDocument(
  zone?: NormalMapZone
): FakeDocument {
  const doc = new FakeDocument();
  if (zone !== undefined) {
    doc.normalMap = doc.normalMap?.withZone(zone) ?? null;
  }
  doc.uv.selectedRegionId = "tile";

  return doc;
}

function targetOf(
  doc: FakeDocument
): NormalMapTarget {
  const target = NormalMapTarget.of(doc);
  assert.ok(target);

  return target;
}

describe("NormalMapTarget", () => {
  test("is null while the normal map is off", () => {
    const doc = createDocument();
    doc.normalMap = null;

    assert.equal(NormalMapTarget.of(doc), null);
  });

  test("targets the texture defaults without a zone for the selection", () => {
    const target = targetOf(createDocument());

    assert.equal(target.zone, null);
    assert.equal(target.off, false);
    assert.deepEqual(target.settings, DEFAULT_NORMAL_MAP_SETTINGS);
    assert.equal(target.overrides("strength"), false);
  });

  test("targets the zone of the selected region", () => {
    const target = targetOf(createDocument({
      regionId: "tile",
      settings: { strength: 6 }
    }));

    assert.equal(target.zone?.regionId, "tile");
    assert.equal(target.settings.strength, 6);
    assert.equal(target.settings.border, DEFAULT_NORMAL_MAP_SETTINGS.border);
    assert.equal(target.overrides("strength"), true);
    assert.equal(target.overrides("border"), false);
  });

  test("an off zone shows the texture defaults", () => {
    const doc = createDocument({
      regionId: "tile",
      settings: "off"
    });
    doc.normalMap = doc.normalMap?.withDefaults({ strength: 3 }) ?? null;

    const target = targetOf(doc);

    assert.equal(target.off, true);
    assert.equal(target.settings.strength, 3);
    assert.equal(target.overrides("strength"), false);
  });

  test("an unfinished write previews the defaults without committing", () => {
    const doc = createDocument();

    targetOf(doc).write({ strength: 7 }, false);

    assert.equal(doc.commits, 0);
    assert.equal(doc.normals.config?.defaults.strength, 7);
    assert.equal(targetOf(doc).settings.strength, 7);
  });

  test("the last write commits the defaults and ends the preview", () => {
    const doc = createDocument();
    const target = targetOf(doc);

    target.write({ strength: 7 }, false);
    target.write({ strength: 8 }, true);

    assert.equal(doc.commits, 1);
    assert.equal(doc.normalMap?.defaults.strength, 8);
    assert.equal(doc.normals.config, doc.normalMap);
  });

  test("writes patch the zone and keep its other overrides", () => {
    const doc = createDocument({
      regionId: "tile",
      settings: { invert: true }
    });
    const target = targetOf(doc);

    target.write({ strength: 2 }, false);
    assert.equal(targetOf(doc).overrides("strength"), true);
    assert.deepEqual(doc.normalMap?.zoneOf("tile")?.settings, { invert: true });

    target.write({ strength: 2 }, true);
    assert.deepEqual(doc.normalMap?.zoneOf("tile")?.settings, {
      invert: true,
      strength: 2
    });
  });

  test("switchOff toggles the zone between off and inherited", () => {
    const doc = createDocument({
      regionId: "tile",
      settings: { strength: 2 }
    });

    targetOf(doc).switchOff(true);
    assert.equal(doc.normalMap?.zoneOf("tile")?.settings, "off");

    targetOf(doc).switchOff(false);
    assert.deepEqual(doc.normalMap?.zoneOf("tile")?.settings, {});
  });

  test("reset drops one override of the zone", () => {
    const doc = createDocument({
      regionId: "tile",
      settings: { strength: 2, invert: true }
    });

    targetOf(doc).reset("strength");

    assert.deepEqual(doc.normalMap?.zoneOf("tile")?.settings, { invert: true });
  });

  test("switchOff and reset leave the texture defaults alone", () => {
    const doc = createDocument();

    targetOf(doc).switchOff(true);
    targetOf(doc).reset("strength");

    assert.equal(doc.commits, 0);
  });
});
