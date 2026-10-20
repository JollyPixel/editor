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
  JsonReporter,
  TableReporter,
  createReport,
  hasFailure,
  hostMetadata,
  type BenchmarkReport
} from "../src/report/index.ts";

function sample(
  suite: string,
  results: object[] = [{ task: "task" }]
): BenchmarkReport<object> {
  return {
    suite,
    runtime: hostMetadata(),
    results
  };
}

describe("hasFailure", () => {
  it("should be true when a row carries an error", () => {
    assert.equal(
      hasFailure({
        suite: "unit",
        runtime: hostMetadata(),
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
        runtime: hostMetadata(),
        results: [{ task: "ok" }]
      }),
      false
    );
  });
});

describe("createReport", () => {
  it("should merge a foreign runtime over the host metadata", () => {
    const value = createReport({
      suite: "unit / browser",
      runtime: { userAgent: "HeadlessChrome" },
      results: [{ task: "task" }]
    });

    assert.equal(value.runtime.userAgent, "HeadlessChrome");
    assert.equal(value.runtime.node, process.version);
  });
});

describe("reporters", () => {
  let log: Mock<typeof console.log>;
  let table: Mock<typeof console.table>;

  beforeEach(() => {
    log = mock.method(console, "log", () => void 0);
    table = mock.method(console, "table", () => void 0);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("should print one JSON line per report in json format", () => {
    const value = sample("unit / json");

    new JsonReporter().print(value);

    assert.equal(log.mock.calls.length, 1);
    assert.deepEqual(JSON.parse(String(log.mock.calls[0].arguments[0])), value);
  });

  it("should print the runtime table once per table reporter", () => {
    const reporter = new TableReporter();

    reporter.print(sample("unit / first"));
    reporter.print(sample("unit / second"));
    new TableReporter().print(sample("unit / third"));

    assert.equal(table.mock.calls.length, 5);
  });

  it("should print a single row vertically and several as a table", () => {
    const single = { task: "only" };
    const several = [{ task: "first" }, { task: "second" }];

    new TableReporter().print(sample("unit / single", [single]));
    new TableReporter().print(sample("unit / several", several));

    assert.equal(table.mock.calls[1].arguments[0], single);
    assert.equal(table.mock.calls[3].arguments[0], several);
  });
});
