// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DEFAULT_NORMAL_MAP_SETTINGS,
  NormalMapConfig
} from "#src/normal/NormalMapConfig.ts";
import {
  InvalidNormalMapSettingsError
} from "#src/normal/errors/InvalidNormalMapSettingsError.ts";
import type { NormalMapData } from "#src/normal/types.ts";

function validData(): NormalMapData {
  return {
    defaults: {
      ...DEFAULT_NORMAL_MAP_SETTINGS,
      bevel: { ...DEFAULT_NORMAL_MAP_SETTINGS.bevel }
    },
    zones: [
      {
        regionId: "brick",
        settings: { height: "regions", strength: 4 }
      },
      {
        regionId: "glass",
        settings: "off"
      }
    ]
  };
}

describe("NormalMapConfig", () => {
  describe("create", () => {
    test("uses the spec defaults", () => {
      const config = NormalMapConfig.create();

      assert.deepEqual(config.toJSON(), {
        defaults: {
          height: "luminance",
          invert: false,
          strength: 2,
          border: "wrap",
          bevel: { width: 1, profile: "round" },
          edgeIntensity: 1,
          levels: 0
        },
        zones: []
      });
    });

    test("overrides the given defaults", () => {
      const config = NormalMapConfig.create({ border: "bevel" });

      assert.equal(config.defaults.border, "bevel");
      assert.equal(config.defaults.height, "luminance");
    });

    test("throws on an invalid setting instead of dropping it", () => {
      assert.throws(
        () => NormalMapConfig.create({ strength: -1 }),
        InvalidNormalMapSettingsError
      );
      assert.throws(
        () => NormalMapConfig.create().withDefaults({ levels: 4 }),
        InvalidNormalMapSettingsError
      );
      assert.throws(
        () => NormalMapConfig.create().withZone({
          regionId: "a",
          settings: { strength: Number.NaN }
        }),
        InvalidNormalMapSettingsError
      );
    });
  });

  describe("parse", () => {
    test("round-trips valid data", () => {
      const config = NormalMapConfig.parse(validData());

      assert.deepEqual(config?.toJSON(), validData());
    });

    test("drops unknown setting keys", () => {
      const data = validData();
      const config = NormalMapConfig.parse({
        ...data,
        defaults: { ...data.defaults, extra: true }
      });

      assert.ok(config);
      assert.equal("extra" in config.defaults, false);
    });

    for (const [label, mutate] of [
      ["an incomplete defaults object", (data: NormalMapData) => {
        Reflect.deleteProperty(data.defaults, "strength");
      }],
      ["an even levels count", (data: NormalMapData) => {
        data.defaults.levels = 4;
      }],
      ["a negative strength", (data: NormalMapData) => {
        data.defaults.strength = -1;
      }],
      ["a zero bevel width", (data: NormalMapData) => {
        data.defaults.bevel = { width: 0, profile: "round" };
      }],
      ["an unknown height mode", (data: NormalMapData) => {
        Reflect.set(data.defaults, "height", "depth");
      }],
      ["duplicate zone regions", (data: NormalMapData) => {
        data.zones.push({ regionId: "brick", settings: "off" });
      }],
      ["an empty zone region id", (data: NormalMapData) => {
        data.zones[0].regionId = "";
      }]
    ] as const) {
      test(`rejects ${label}`, () => {
        const data = validData();
        mutate(data);

        assert.equal(NormalMapConfig.parse(data), null);
      });
    }

    test("rejects non objects", () => {
      assert.equal(NormalMapConfig.parse(null), null);
      assert.equal(NormalMapConfig.parse([]), null);
      assert.equal(NormalMapConfig.parse("normal"), null);
    });
  });

  describe("zones", () => {
    test("withZone appends a new zone and replaces an existing one in place", () => {
      const config = NormalMapConfig.from(validData())
        .withZone({ regionId: "moss", settings: { invert: true } })
        .withZone({ regionId: "brick", settings: "off" });

      assert.deepEqual(
        config.zones.map((zone) => zone.regionId),
        ["brick", "glass", "moss"]
      );
      assert.equal(config.zoneOf("brick")?.settings, "off");
    });

    test("withZone inserts a new zone at the given index", () => {
      const config = NormalMapConfig.from(validData())
        .withZone({ regionId: "moss", settings: "off" }, 0);

      assert.equal(config.indexOf("moss"), 0);
    });

    test("withoutZone removes the zone and returns the same config when absent", () => {
      const config = NormalMapConfig.from(validData());

      assert.equal(config.withoutZone("unknown"), config);
      assert.equal(config.withoutZone("brick").indexOf("brick"), -1);
    });

    test("is immutable", () => {
      const data = validData();
      const config = NormalMapConfig.from(data);
      data.zones[0].regionId = "changed";

      assert.equal(config.zones[0].regionId, "brick");
      assert.equal(Reflect.set(config.defaults, "strength", 10), false);
      assert.equal(Reflect.set(config.defaults.bevel, "width", 3), false);
      assert.equal(Object.isFrozen(config.zones[0]), true);
    });
  });

  describe("resolve", () => {
    test("returns the defaults when no zone matches", () => {
      const config = NormalMapConfig.from(validData());

      assert.deepEqual(config.resolve(["other"]), config.defaults);
    });

    test("merges the zone over the defaults", () => {
      const settings = NormalMapConfig.from(validData()).resolve(["brick"]);

      assert.notEqual(settings, "off");
      assert.equal(settings !== "off" && settings.height, "regions");
      assert.equal(settings !== "off" && settings.strength, 4);
      assert.equal(settings !== "off" && settings.border, "wrap");
    });

    test("lets the newest zone win on a shared island", () => {
      const config = NormalMapConfig.from(validData());

      assert.equal(config.resolve(["brick", "glass"]), "off");
      assert.equal(config.winningZone(["glass", "brick"])?.regionId, "glass");
    });
  });
});
