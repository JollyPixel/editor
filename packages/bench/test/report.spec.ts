// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  beforeEach,
  describe,
  it,
  mock,
  type Mock
} from "node:test";

// Import Internal Dependencies
import {
  configure,
  resetConfig
} from "../src/config.ts";
import {
  hasFailure,
  report,
  resetTableReporter,
  runtimeMetadata
} from "../src/report/index.ts";

describe("hasFailure", () => {
  it("should be true when a row carries an error", () => {
    assert.equal(
      hasFailure({
        suite: "unit",
        runtime: runtimeMetadata(),
        results: [
          { task: "ok" },
          { task: "ko", error: "boom" }
        ]
      }),
      true
    );
  });

  it("should be false when no row carries an error", () => {
    assert.equal(
      hasFailure({
        suite: "unit",
        runtime: runtimeMetadata(),
        results: [{ task: "ok" }]
      }),
      false
    );
  });
});

describe("runtimeMetadata", () => {
  afterEach(() => {
    resetConfig();
  });

  it("should describe the host and the sampling budget", () => {
    configure({
      time: 42,
      iterations: 7
    });
    const metadata = runtimeMetadata();

    assert.equal(metadata.node, process.version);
    assert.equal(metadata.timeMs, 42);
    assert.equal(metadata.iterations, 7);
    assert.equal(typeof metadata.cpu, "string");
  });
});

describe("report", () => {
  let log: Mock<typeof console.log>;
  let table: Mock<typeof console.table>;

  beforeEach(() => {
    resetConfig();
    log = mock.method(console, "log", () => void 0);
    table = mock.method(console, "table", () => void 0);
  });

  afterEach(() => {
    mock.restoreAll();
    resetTableReporter();
    resetConfig();
  });

  it("should print one JSON line per suite in json format", () => {
    configure({ format: "json" });

    const value = report({
      suite: "unit / json",
      results: [{ task: "task" }]
    });

    assert.equal(log.mock.calls.length, 1);
    assert.deepEqual(
      JSON.parse(String(log.mock.calls[0].arguments[0])),
      value
    );
  });

  it("should print the runtime table only once", () => {
    report({
      suite: "unit / first",
      results: [{ task: "task" }]
    });
    report({
      suite: "unit / second",
      results: [{ task: "task" }]
    });

    assert.equal(table.mock.calls.length, 3);
  });

  it("should merge a foreign runtime over the host metadata", () => {
    configure({ format: "json" });

    const value = report({
      suite: "unit / browser",
      runtime: { userAgent: "HeadlessChrome" },
      results: [{ task: "task" }]
    });

    assert.equal(value.runtime.userAgent, "HeadlessChrome");
    assert.equal(value.runtime.node, process.version);
  });
});
