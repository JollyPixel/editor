// Import Third-party Dependencies
import {
  Flag,
  LoadHarness
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  SCENARIOS,
  type LoadServerConfig,
  type Workload
} from "./protocol.ts";

const harness = new LoadHarness({
  name: "network / load",
  summary: `Starts a network server in a child process and drives it with WebSocket
clients spread over worker threads.`,
  flags: {
    scenario: Flag.choice(SCENARIOS, "presence", "scenario"),
    rooms: Flag.positive(5, "rooms the clients spread over"),
    variants: Flag.positive(20, "command variants in the protocol"),
    "snapshot-bytes": Flag.positive(65_536, "snapshot size sent on join"),
    rights: Flag.toggle("gate every event through a rights table")
  },
  server: new URL("./server.ts", import.meta.url),
  driver: new URL("./driver.ts", import.meta.url),
  plan: (values) => {
    const serverConfig: LoadServerConfig = {
      rooms: values.rooms,
      variants: values.variants,
      snapshotBytes: values["snapshot-bytes"],
      compression: values.compression,
      rights: values.rights
    };
    const workload: Workload = {
      scenario: values.scenario,
      rooms: values.rooms,
      variants: values.variants
    };

    return {
      serverConfig,
      workload,
      columns: {
        scenario: values.scenario,
        clients: values.clients,
        rooms: values.rooms,
        "rate (Hz)": values.rate,
        compression: values.compression,
        rights: values.rights
      }
    };
  }
});

await harness.run();
