// Import Third-party Dependencies
import {
  BenchmarkError,
  Flag,
  LoadHarness
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  SCENARIOS,
  type LoadServerConfig,
  type Workload
} from "./protocol.ts";

// CONSTANTS
const kStores = ["sqlite", "memory"] as const;

const harness = new LoadHarness({
  name: "asset-server / load",
  summary: `Starts an asset backend in a child process and drives it with WebSocket and
HTTP clients spread over worker threads.`,
  flags: {
    scenario: Flag.choice(SCENARIOS, "edit", "scenario"),
    assets: Flag.positive(1_000, "binary assets in the catalog"),
    grids: Flag.positive(5, "live grid assets, one room each"),
    "content-bytes": Flag.positive(65_536, "grid content size"),
    store: Flag.choice(kStores, "sqlite", "event store"),
    grace: Flag.nonNegative(0, "asset room grace period", "ms"),
    "snapshot-delay": Flag.nonNegative(
      2_000,
      "quiet period before a snapshot",
      "ms"
    ),
    etag: Flag.toggle("send If-None-Match in the http scenario")
  },
  server: new URL("./server.ts", import.meta.url),
  driver: new URL("./driver.ts", import.meta.url),
  plan: (values) => {
    if (values.scenario === "catalog" && values.assets < values.clients) {
      throw new BenchmarkError(
        "--assets must be at least --clients for catalog"
      );
    }

    const serverConfig: LoadServerConfig = {
      assets: values.assets,
      grids: values.grids,
      contentBytes: values["content-bytes"],
      store: values.store,
      graceMs: values.grace,
      snapshotDelayMs: values["snapshot-delay"],
      compression: values.compression
    };
    const workload: Workload = {
      scenario: values.scenario,
      grids: values.grids,
      etag: values.etag
    };

    return {
      serverConfig,
      workload,
      columns: {
        scenario: values.scenario,
        clients: values.clients,
        "rate (Hz)": values.rate,
        assets: values.assets,
        grids: values.grids,
        "content (KB)": values["content-bytes"] / 1_024,
        store: values.store
      }
    };
  }
});

await harness.run();
