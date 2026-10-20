// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { BenchmarkError } from "../../src/errors/index.ts";
import type { Reporter } from "../../src/report/index.ts";
import { batched } from "../../src/suite/batched.ts";
import {
  defineSuite,
  runSuites
} from "../../src/suite/suite.ts";
import { fastConfig } from "../helpers/config.ts";

describe("defineSuite", () => {
  it("should report one row per task", async() => {
    const suite = defineSuite("unit / rows", (bench) => {
      bench
        .add("first", () => void 0)
        .add("second", () => void 0);
    });

    const report = await suite.run(fastConfig());

    assert.ok(report !== null);
    assert.equal(report.suite, "unit / rows");
    assert.deepEqual(report.results.map((row) => row.task), [
      "first",
      "second"
    ]);
  });

  it("should describe the host and the sampling budget", async() => {
    const suite = defineSuite("unit / runtime", (bench) => {
      bench.add("task", () => void 0);
    });

    const report = await suite.run(fastConfig({
      time: 2,
      iterations: 3
    }));

    assert.ok(report !== null);
    assert.equal(report.runtime.node, process.version);
    assert.equal(report.runtime.timeMs, 2);
    assert.equal(report.runtime.iterations, 3);
  });

  it("should omit ns/op when one iteration is one operation", async() => {
    const suite = defineSuite("unit / plain", (bench) => {
      bench.add("task", () => void 0);
    });

    const report = await suite.run(fastConfig());

    assert.ok(report !== null);
    assert.equal(report.results[0]["ns/op"], undefined);
    assert.equal(typeof report.results[0]["ops/sec"], "number");
  });

  it("should divide only batched tasks by the batch size", async() => {
    const suite = defineSuite("unit / batched", (bench) => {
      bench
        .add("plain", () => void 0)
        .add("batched", batched(() => void 0));
    }, { opsPerIteration: 2 });

    const report = await suite.run(fastConfig({ batch: 10 }));

    assert.ok(report !== null);
    const [plain, batch] = report.results;
    for (const [row, opsPerIteration] of [[plain, 2], [batch, 20]] as const) {
      const expected = Number(row["mean (ms)"]) * 1e6 / opsPerIteration;
      assert.ok(Math.abs(Number(row["ns/op"]) - expected) < 0.5, row.task);
    }
  });

  it("should report no B/op unless allocations are enabled", async() => {
    const suite = defineSuite("unit / no allocations", (bench) => {
      bench.add("task", () => void 0);
    });

    const report = await suite.run(fastConfig());

    assert.ok(report !== null);
    assert.equal(report.results[0]["B/op"], undefined);
  });

  it("should measure the heap bytes each operation allocates", async() => {
    const sink: unknown[][] = [];
    const suite = defineSuite("unit / allocations", (bench) => {
      bench
        .add("allocating", batched(() => {
          sink[0] = Array.from({ length: 1_000 }, () => 0);
        }))
        .add("idle", batched(() => void 0));
    });

    const report = await suite.run(fastConfig({
      allocations: true,
      batch: 10
    }));

    assert.ok(report !== null);
    const [allocating, idle] = report.results;
    assert.ok(allocating["B/op"] !== undefined && allocating["B/op"] >= 8_000);
    assert.ok(idle["B/op"] !== undefined && idle["B/op"] < 64);
  });

  it("should skip B/op for tasks whose per-iteration hooks allocate", async() => {
    const suite = defineSuite("unit / hooked allocations", (bench) => {
      bench.add("task", () => void 0, {
        beforeEach: () => void 0
      });
    });

    const report = await suite.run(fastConfig({ allocations: true }));

    assert.ok(report !== null);
    assert.equal(report.results[0]["B/op"], undefined);
  });

  it("should call the setup on every run", async() => {
    let setups = 0;
    const suite = defineSuite("unit / setup", (bench) => {
      setups++;
      bench.add("task", () => void 0);
    });

    await suite.run(fastConfig());
    await suite.run(fastConfig());

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

    await suite.run(fastConfig());

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

    const report = await suite.run(fastConfig());

    assert.ok(released);
    assert.ok(report !== null);
    assert.equal(report.results[0].error, "boom");
  });

  it("should keep only the tasks matching the filter", async() => {
    const suite = defineSuite("unit / filter", (bench) => {
      bench
        .add("kept task", () => void 0)
        .add("dropped task", () => void 0);
    });

    const report = await suite.run(fastConfig({ task: "kept" }));

    assert.ok(report !== null);
    assert.deepEqual(report.results.map((row) => row.task), ["kept task"]);
  });

  it("should resolve to null when the filter drops every task", async() => {
    const suite = defineSuite("unit / no match", (bench) => {
      bench.add("task", () => void 0);
    });

    assert.equal(await suite.run(fastConfig({ task: "absent" })), null);
  });
});

describe("runSuites", () => {
  function collect(
    printed: string[]
  ): Reporter {
    return {
      print: (report) => {
        printed.push(report.suite);
      }
    };
  }

  it("should run and print every suite in order", async() => {
    const printed: string[] = [];
    const first = defineSuite("unit / first", (bench) => {
      bench.add("task", () => void 0);
    });
    const second = defineSuite("unit / second", (bench) => {
      bench.add("task", () => void 0);
    });

    const reports = await runSuites([first, second], {
      config: fastConfig(),
      reporter: collect(printed)
    });

    assert.deepEqual(reports.map((report) => report.suite), [
      "unit / first",
      "unit / second"
    ]);
    assert.deepEqual(printed, [
      "unit / first",
      "unit / second"
    ]);
  });

  it("should skip the suites the filter emptied", async() => {
    const printed: string[] = [];
    const matching = defineSuite("unit / matching", (bench) => {
      bench.add("kept task", () => void 0);
    });
    const other = defineSuite("unit / other", (bench) => {
      bench.add("dropped task", () => void 0);
    });

    const reports = await runSuites([matching, other], {
      config: fastConfig({ task: "kept" }),
      reporter: collect(printed)
    });

    assert.deepEqual(reports.map((report) => report.suite), [
      "unit / matching"
    ]);
    assert.deepEqual(printed, ["unit / matching"]);
  });

  it("should throw when the filter matched no task at all", async() => {
    const suite = defineSuite("unit / empty", (bench) => {
      bench.add("task", () => void 0);
    });

    await assert.rejects(
      () => runSuites([suite], {
        config: fastConfig({ task: "absent" }),
        reporter: collect([])
      }),
      (error: Error) => {
        assert.ok(error instanceof BenchmarkError);
        assert.match(error.message, /No benchmark task matched "absent"/);

        return true;
      }
    );
  });

  it("should throw when there is no suite to run", async() => {
    await assert.rejects(
      () => runSuites([], { config: fastConfig() }),
      (error: Error) => {
        assert.ok(error instanceof BenchmarkError);
        assert.match(error.message, /No benchmark suite to run/);

        return true;
      }
    );
  });
});
