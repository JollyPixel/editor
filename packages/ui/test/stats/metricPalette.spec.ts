// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  resolveMetricPalette,
  type StatsThemeColors
} from "../../src/stats/metricPalette.ts";
import {
  FPS_METRIC,
  MS_METRIC,
  WORST_MS_METRIC,
  memoryMetric
} from "../../src/stats/builtins.ts";

// CONSTANTS
const kTheme: StatsThemeColors = {
  accent: "accent",
  bed: "bed",
  success: "success",
  warning: "warning"
};

function tagResolver(
  value: string,
  fallback: string
): string {
  return `${value}|${fallback}`;
}

describe("resolveMetricPalette", () => {
  it("uses the accent ink without a direction or palette", () => {
    const palette = resolveMetricPalette(
      {
        id: "entities",
        label: "ENTITIES"
      },
      kTheme,
      tagResolver
    );

    assert.deepEqual(palette, {
      ink: "accent",
      bed: "bed"
    });
  });

  it("derives the ink from the better direction", () => {
    const higher = resolveMetricPalette(
      {
        id: "a",
        label: "A",
        better: "higher"
      },
      kTheme,
      tagResolver
    );
    const lower = resolveMetricPalette(
      {
        id: "b",
        label: "B",
        better: "lower"
      },
      kTheme,
      tagResolver
    );

    assert.equal(higher.ink, "success");
    assert.equal(lower.ink, "warning");
  });

  it("resolves palette colors against the derived fallbacks", () => {
    const palette = resolveMetricPalette(
      {
        id: "a",
        label: "A",
        better: "higher",
        palette: {
          ink: "red",
          bed: "black"
        }
      },
      kTheme,
      tagResolver
    );

    assert.deepEqual(palette, {
      ink: "red|success",
      bed: "black|bed"
    });
  });

  it("resolves a partial palette per color", () => {
    const palette = resolveMetricPalette(
      {
        id: "a",
        label: "A",
        palette: {
          bed: "black"
        }
      },
      kTheme,
      tagResolver
    );

    assert.deepEqual(palette, {
      ink: "accent",
      bed: "black|bed"
    });
  });

  it("gives every built-in metric a palette through the public field", () => {
    const memory = memoryMetric({
      now: () => 0,
      memory: {
        usedJSHeapSize: 0
      }
    });
    if (memory === null) {
      assert.fail("memory metric should register");
    }

    for (const definition of [
      FPS_METRIC,
      MS_METRIC,
      WORST_MS_METRIC,
      memory
    ]) {
      assert.equal(typeof definition.palette?.ink, "string");
      assert.equal(typeof definition.palette?.bed, "string");
    }
  });
});
