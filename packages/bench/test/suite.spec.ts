// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  beforeEach,
  describe,
  it,
  mock
} from "node:test";

// Import Internal Dependencies
import { BenchmarkError } from "../src/errors/index.ts";
import {
  configure,
  resetConfig
} from "../src/config.ts";
import { resetTableReporter } from "../src/report/index.ts";
import {
  batched,
  defineSuite,
  runSuites
} from "../src/suite.ts";

describe("defineSuite", () => {
  beforeEach(() => {
    resetConfig();
    // Keep benchmark tests within milliseconds.
    configure({
      time: 1,
      iterations: 1,
      warmupTime: 1,
      warmupIterations: 1,
      format: "json"
    });
    mock.method(console, "log", () => void 0);
  });

  afterEach(() => {
    mock.restoreAll();
    resetTableReporter();
    resetConfig();
  });

  it("should report one row per task", async() => {
    const suite = defineSuite("unit / rows", (bench) => {
      bench
        .add("first", () => void 0)
        .add("second", () => void 0);
    });

    const report = await suite.run();

    assert.ok(report !== null);
    assert.equal(report.suite, "unit / rows");
    assert.deepEqual(report.results.map((row) => row.task), [
      "first",
      "second"
    ]);
  });

  it("should omit ns/op when one iteration is one operation", async() => {
    const suite = defineSuite("unit / plain", (bench) => {
      bench.add("task", () => void 0);
    });

    const report = await suite.run();

    assert.ok(report !== null);
    assert.equal(report.results[0]["ns/op"], undefined);
    assert.equal(typeof report.results[0]["ops/sec"], "number");
  });

  it("should divide batched measurements back out into ns/op", async() => {
    configure({ batch: 10 });
    const suite = defineSuite("unit / batched", (bench) => {
      bench.add("task", batched(() => void 0));
    }, { opsPerIteration: "batch" });

    const report = await suite.run();

    assert.ok(report !== null);
    assert.equal(typeof report.results[0]["ns/op"], "number");
  });

  it("should call the setup on every run", async() => {
    let setups = 0;
    const suite = defineSuite("unit / setup", (bench) => {
      setups++;
      bench.add("task", () => void 0);
    });

    await suite.run();
    await suite.run();

    assert.equal(setups, 2);
  });

  it("should release the teardown after the run", async() => {
    const order: string[] = [];
    const suite = defineSuite("unit / teardown", (bench) => {
      bench.add("task", () => order.push("task"));

      return () => {
        order.push("teardown");
      };
    });

    await suite.run();

    assert.equal(order.at(-1), "teardown");
    assert.ok(order.includes("task"));
  });

  it("should release the teardown even when a task throws", async() => {
    let released = false;
    const suite = defineSuite("unit / teardown on error", (bench) => {
      bench.add("task", () => {
        throw new Error("boom");
      });

      return () => {
        released = true;
      };
    });

    const report = await suite.run();

    assert.ok(released);
    assert.ok(report !== null);
    assert.equal(report.results[0].error, "boom");
  });

  it("should keep only the tasks matching the filter", async() => {
    configure({ task: "kept" });
    const suite = defineSuite("unit / filter", (bench) => {
      bench
        .add("kept task", () => void 0)
        .add("dropped task", () => void 0);
    });

    const report = await suite.run();

    assert.ok(report !== null);
    assert.deepEqual(report.results.map((row) => row.task), ["kept task"]);
  });

  it("should resolve to null when the filter drops every task", async() => {
    configure({ task: "absent" });
    const suite = defineSuite("unit / no match", (bench) => {
      bench.add("task", () => void 0);
    });

    assert.equal(await suite.run(), null);
  });
});

describe("runSuites", () => {
  beforeEach(() => {
    resetConfig();
    configure({
      time: 1,
      iterations: 1,
      warmupTime: 1,
      warmupIterations: 1,
      format: "json"
    });
    mock.method(console, "log", () => void 0);
  });

  afterEach(() => {
    mock.restoreAll();
    resetTableReporter();
    resetConfig();
  });

  it("should run every suite in order", async() => {
    const first = defineSuite("unit / first", (bench) => {
      bench.add("task", () => void 0);
    });
    const second = defineSuite("unit / second", (bench) => {
      bench.add("task", () => void 0);
    });

    const reports = await runSuites([first, second]);

    assert.deepEqual(reports.map((report) => report.suite), [
      "unit / first",
      "unit / second"
    ]);
  });

  it("should skip the suites the filter emptied", async() => {
    configure({ task: "kept" });
    const matching = defineSuite("unit / matching", (bench) => {
      bench.add("kept task", () => void 0);
    });
    const other = defineSuite("unit / other", (bench) => {
      bench.add("dropped task", () => void 0);
    });

    const reports = await runSuites([matching, other]);

    assert.deepEqual(reports.map((report) => report.suite), [
      "unit / matching"
    ]);
  });

  it("should throw when the filter matched no task at all", async() => {
    configure({ task: "absent" });
    const suite = defineSuite("unit / empty", (bench) => {
      bench.add("task", () => void 0);
    });

    await assert.rejects(
      () => runSuites([suite]),
      (error: Error) => {
        assert.ok(error instanceof BenchmarkError);
        assert.match(error.message, /No benchmark task matched "absent"/);

        return true;
      }
    );
  });

  it("should throw when there is no suite to run", async() => {
    await assert.rejects(
      () => runSuites([]),
      (error: Error) => {
        assert.ok(error instanceof BenchmarkError);
        assert.match(error.message, /No benchmark suite to run/);

        return true;
      }
    );
  });
});

describe("batched", () => {
  afterEach(() => {
    resetConfig();
  });

  it("should call the body once per configured batch unit", () => {
    configure({ batch: 7 });
    let calls = 0;
    const task = batched(() => {
      calls++;
    });

    task();

    assert.equal(calls, 7);
  });

  it("should read the batch size at call time", () => {
    let calls = 0;
    const task = batched(() => {
      calls++;
    });

    configure({ batch: 3 });
    task();

    assert.equal(calls, 3);
  });
});
