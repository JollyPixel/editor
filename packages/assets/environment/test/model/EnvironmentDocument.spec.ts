// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { EnvironmentDocument } from "#src/model/EnvironmentDocument.ts";

describe("EnvironmentDocument", () => {
  test("undoes a change by restoring only the sections it set", () => {
    const document = new EnvironmentDocument();
    const inverses: unknown[] = [];
    document.on("change", (change) => {
      inverses.push(...change.inverse);
    });

    document.change({ fog: { kind: "exp2", color: "#ffffff", density: 0.1 } });
    document.change({ sky: { kind: "day" } });
    document.applyStep(inverses[0] as never);

    assert.deepEqual(document.file.fog, { kind: "none" });
    assert.deepEqual(document.file.sky, { kind: "day" });
  });

  test("restores the sections of reverted changes and keeps the others", () => {
    const document = new EnvironmentDocument();
    const images: unknown[] = [];
    document.on("change", (change) => {
      images.push(change.image);
    });

    document.change({ toneMapping: { kind: "aces", exposure: 0.9 } });
    document.applyRemote({ action: "environment-changed", set: { sky: { kind: "night" } } });
    document.revert(images.slice(0, 1) as never);

    assert.deepEqual(
      document.file.toneMapping,
      Systems.ENVIRONMENT_PRESETS.default.toneMapping
    );
    assert.deepEqual(document.file.sky, { kind: "night" });
  });
});
