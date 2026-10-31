// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import { Tour } from "@jolly-pixel/lantern";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  mountLantern,
  type PageLantern
} from "#src/ui/lantern/mountLantern.ts";
import { captureLogs } from "../../helpers/logs.ts";

// CONSTANTS
const kTour = new Tour({
  id: "host.test",
  version: 1,
  title: "Test tour",
  steps: [
    {
      id: "welcome",
      title: "Welcome",
      body: "Hello"
    }
  ]
});

let mounted: PageLantern | undefined;

function mount(): PageLantern {
  mounted = mountLantern({
    commands: new CommandConsole(),
    logger: captureLogs().logger,
    storage: new MemoryStorageAdapter()
  });

  return mounted;
}

async function settle(): Promise<void> {
  await import("@jolly-pixel/lantern/element");
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe("mountLantern", () => {
  afterEach(() => {
    mounted?.dispose();
    mounted = undefined;
    document.body.replaceChildren();
  });

  test("appends no overlay before a tour starts", async() => {
    mount();
    await settle();

    assert.equal(document.querySelector("jolly-lantern"), null);
  });

  test("mounts nothing when disposed while the overlay loads", async() => {
    const { lantern } = mount();
    lantern.start(kTour);
    mounted?.dispose();
    mounted = undefined;
    await settle();

    assert.equal(document.querySelector("jolly-lantern"), null);
  });
});
