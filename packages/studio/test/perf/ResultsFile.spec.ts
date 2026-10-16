// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import { ResultsFile } from "../../perf/harness/ResultsFile.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

// CONSTANTS
const kOpenMeasurements = [
  { label: "control", editor: "voxel-map", phase: "first" }
];
const kSteadyMeasurements = [
  { editor: "voxel-map", scenario: "orbit" }
];

describe("ResultsFile", () => {
  let dir: string;

  beforeEach(async() => {
    dir = await createTempDir("studio-perf-results-");
    await writeJson("open.json", { kind: "open", measurements: kOpenMeasurements });
    await writeJson("steady.json", { kind: "steady", measurements: kSteadyMeasurements });
  });

  afterEach(async() => {
    await removeTempDir(dir);
  });

  test("reads only the results of the requested kind from a folder", () => {
    assert.deepEqual(ResultsFile.read(dir, "open"), kOpenMeasurements);
    assert.deepEqual(ResultsFile.read(dir, "steady"), kSteadyMeasurements);
  });

  test("rejects a file of another kind or without a kind", async() => {
    await writeJson("legacy.json", { measurements: kSteadyMeasurements });

    assert.throws(
      () => ResultsFile.read(path.join(dir, "steady.json"), "open"),
      /holds steady results, not open results/
    );
    assert.throws(
      () => ResultsFile.read(path.join(dir, "legacy.json"), "open"),
      /is not a results file/
    );
  });

  async function writeJson(
    file: string,
    value: unknown
  ): Promise<void> {
    await fs.writeFile(path.join(dir, file), JSON.stringify(value));
  }
});
