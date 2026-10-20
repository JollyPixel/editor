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
import { BenchmarkError } from "../../src/errors/index.ts";
import { Flag } from "../../src/flags/Flag.ts";
import { LoadHarness } from "../../src/load/LoadHarness.ts";
import type { FixtureWorkload } from "../fixtures/load/driver.ts";

// CONSTANTS
const kClients = 2;
const kRate = 200;
const kRun = [
  "--clients",
  String(kClients),
  "--workers",
  "1",
  "--rate",
  String(kRate),
  "--duration",
  "0.4",
  "--warmup",
  "0.1",
  "--json"
];

function fixtureHarness(): LoadHarness<
  { "round-trip": number; },
  null,
  FixtureWorkload
> {
  return new LoadHarness({
    name: "fixture / load",
    summary: "Drives the fixture server.",
    flags: {
      "round-trip": Flag.nonNegative(0, "round trip duration", "ms")
    },
    server: new URL("../fixtures/load/server.ts", import.meta.url),
    driver: new URL("../fixtures/load/driver.ts", import.meta.url),
    plan: (values) => {
      if (values.clients > 10) {
        throw new BenchmarkError("--clients is capped at 10");
      }

      return {
        serverConfig: null,
        workload: { roundTripMs: values["round-trip"] },
        columns: { clients: values.clients }
      };
    }
  });
}

describe("LoadHarness", () => {
  let log: Mock<typeof console.log>;
  let error: Mock<typeof console.error>;

  beforeEach(() => {
    log = mock.method(console, "log", () => void 0);
    error = mock.method(console, "error", () => void 0);
    mock.method(console, "table", () => void 0);
    mock.method(console, "warn", () => void 0);
  });

  afterEach(() => {
    mock.restoreAll();
    process.exitCode = undefined;
  });

  it("should list the harness flags before the shared ones", () => {
    const usage = fixtureHarness().usage();

    assert.match(usage, /^Usage: pnpm bench:load \[options\]\n\nDrives the fixture server\./);
    assert.ok(usage.indexOf("--round-trip <ms>") < usage.indexOf("--clients <n>"));
    assert.match(usage, /--clients <n> +connected clients \(default 50\)/);
  });

  it("should print the usage for --help without running", async() => {
    const harness = fixtureHarness();

    assert.equal(await harness.run(["--help"]), null);
    assert.equal(log.mock.calls[0].arguments[0], harness.usage());
  });

  it("should report a rejected flag or plan and fail the exit code", async() => {
    for (const argv of [["--clients", "0"], ["--clients", "11"]]) {
      process.exitCode = undefined;

      assert.equal(await fixtureHarness().run(argv), null);
      assert.equal(process.exitCode, 1);
    }

    assert.deepEqual(error.mock.calls.map((call) => call.arguments[0]), [
      "--clients expects a positive number, got \"0\"",
      "--clients is capped at 10"
    ]);
  });

  it("should drive the entries and report one row with the load settings", async() => {
    const value = await fixtureHarness().run(kRun);

    assert.ok(value !== null);
    assert.equal(value.suite, "fixture / load");
    assert.equal(value.runtime.workers, 1);
    assert.equal(value.runtime.durationMs, 400);

    const [row] = value.results;
    assert.equal(row.clients, kClients);
    assert.ok(Number(row["sent/s"]) > 0);
    assert.equal(row["own p50 (ms)"], null);
    assert.deepEqual(JSON.parse(String(log.mock.calls[0].arguments[0])), value);
  });

  it("should hold each entry until its round trip settles and time it", async() => {
    const value = await fixtureHarness().run([...kRun, "--round-trip", "25"]);

    assert.ok(value !== null);
    const [row] = value.results;
    assert.ok(Number(row["own p50 (ms)"]) >= 20);
    assert.ok(Number(row["sent/s"]) <= kClients * (1_000 / 25) * 1.2);
  });
});
