// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import { BINARY_KIND } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import "../test/setup.ts";
import {
  mountStandalone,
  type MountStandaloneOptions
} from "#src/boot/mountStandalone.ts";
import type {
  EditorDefinition,
  EditorHandle
} from "#src/contract/EditorDefinition.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { OfflineServer } from "#src/offline/server/OfflineServer.ts";
import { printSideReport } from "./_fixtures.ts";

// CONSTANTS
const kFirstId = "first-target";
const kSecondId = "second-target";

interface StepTotal {
  task: string;
  step: string;
  count: number;
  ms: number;
}

class StepTimes {
  readonly #totals = new Map<string, StepTotal>();

  collect(
    task: string
  ): void {
    for (const entry of performance.getEntriesByType("measure")) {
      const key = `${task}\n${entry.name}`;
      const total = this.#totals.get(key) ?? {
        task,
        step: entry.name,
        count: 0,
        ms: 0
      };
      total.count++;
      total.ms += entry.duration;
      this.#totals.set(key, total);
    }
    performance.clearMeasures();
  }

  print(): void {
    const results = Array.from(this.#totals.values(), (total) => {
      return {
        task: total.task,
        step: total.step,
        "mean ms": Number((total.ms / total.count).toFixed(3))
      };
    });
    printSideReport("boot / host steps", results);
  }
}

function binarySeed(
  id: string,
  byte: number
) {
  return {
    id,
    kind: BINARY_KIND,
    content: () => new Uint8Array([byte])
  };
}

const kDefinition: EditorDefinition<EditorHandle> = {
  accepts: BINARY_KIND,
  identity: {
    title: "bench"
  },
  kinds: [],
  mount: (context) => Promise.resolve({
    ready: Promise.resolve(),
    session: context.session,
    runtime: null,
    dispose: () => undefined
  })
};

const suite = defineSuite("boot / mountStandalone on OfflineServer", async(bench) => {
  const steps = new StepTimes();
  const server = await OfflineServer.open({
    handlers: [],
    seed: {
      "notes/first.bin": binarySeed(kFirstId, 1),
      "notes/second.bin": binarySeed(kSecondId, 2)
    }
  });
  const options: MountStandaloneOptions = {
    sources: [
      {
        read: () => Promise.resolve(EditorLaunch.fromTarget(kFirstId))
      }
    ],
    connect: () => server.connect()
  };
  const editor = await mountStandalone(kDefinition, options);
  let next = kSecondId;

  function timeSteps(
    task: string
  ): Parameters<typeof bench.add>[2] {
    return {
      beforeAll: () => performance.clearMeasures(),
      afterAll: () => steps.collect(task)
    };
  }

  bench
    .add("switch target", async() => {
      await editor.navigate(next, null);
      next = next === kFirstId ? kSecondId : kFirstId;
    }, timeSteps("switch target"))
    .add("mount then dispose", async() => {
      const mounted = await mountStandalone(kDefinition, options);
      mounted.dispose();
    }, timeSteps("mount then dispose"));

  return async() => {
    editor.dispose();
    await server.close();
    steps.print();
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
