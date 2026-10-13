// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import {
  AssetId,
  AssetNotFoundError
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { BootTrace } from "#src/editor/BootTrace.ts";
import type { EditorHandle } from "#src/editor/EditorDefinition.ts";
import { EditorMount } from "#src/editor/EditorMount.ts";
import { readDebugLogger } from "#src/debug/readDebugLogger.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { LaunchHistory } from "#src/launch/LaunchHistory.ts";
import { EditorToolbarSources } from "#src/session/EditorToolbarSources.ts";
import { PageState } from "#src/state/PageState.ts";
import { editorHandle } from "../helpers/editorHandle.ts";
import { fakeConnection } from "../helpers/session/connection.ts";
import {
  editorState,
  resetStandalonePage
} from "../helpers/standalone.ts";

// CONSTANTS
const kFirst = "map";
const kSecond = "grass";

class MemoryHistory implements LaunchHistory {
  readonly recorded: string[] = [];
  readonly reloaded: string[] = [];

  #listener: ((launch: EditorLaunch) => void) | null = null;

  record(
    launch: EditorLaunch
  ): void {
    this.recorded.push(launch.target.value);
  }

  reload(
    launch: EditorLaunch
  ): void {
    this.reloaded.push(launch.target.value);
  }

  follow(
    listener: (launch: EditorLaunch) => void,
    signal: AbortSignal
  ): void {
    this.#listener = listener;
    signal.addEventListener("abort", () => {
      this.#listener = null;
    });
  }

  back(
    target: string
  ): void {
    this.#listener?.(new EditorLaunch(new AssetId(target)));
  }
}

async function startMount(
  mounting: (target: string) => Promise<void> = () => Promise.resolve()
) {
  const { connection } = await fakeConnection();
  const history = new MemoryHistory();
  const events: string[] = [];
  const mount = new EditorMount<EditorHandle>({
    sessions: {
      open: (launch) => connection.openSession({
        launch,
        accepts: connection.catalog.record(launch.target.value)?.kind ??
          "voxelmap",
        kinds: []
      })
    },
    toolbar: (launch) => {
      const sources = new EditorToolbarSources(null, null);

      return Object.assign(sources, {
        dispose: () => events.push(`toolbar ${launch.target.value} disposed`)
      });
    },
    mount: async({ launch, session }) => {
      const target = launch.target.value;
      const leased = [kFirst, kSecond]
        .filter((assetId) => connection.assets.has(assetId));
      events.push(`${target} mounted while ${leased.join(", ")} leased`);
      await mounting(target);

      return {
        ...editorHandle(session),
        dispose: () => events.push(`${target} disposed`)
      };
    },
    history,
    logger: readDebugLogger()
  });
  await mount.start(
    new EditorLaunch(new AssetId(kFirst)),
    new BootTrace(readDebugLogger(), new PageState())
  );
  events.length = 0;

  return {
    connection,
    history,
    events,
    mount
  };
}

async function untilReady(): Promise<void> {
  do {
    await setImmediate();
  } while (editorState() !== "ready");
}

describe("EditorMount", () => {
  afterEach(resetStandalonePage);

  test("a switch mounts the next editor before releasing the previous session", async() => {
    const { connection, history, events, mount } = await startMount();

    await mount.navigate(kSecond, null);

    assert.deepEqual(events, [
      `toolbar ${kFirst} disposed`,
      `${kFirst} disposed`,
      `${kSecond} mounted while ${kFirst}, ${kSecond} leased`
    ]);
    assert.equal(connection.assets.has(kFirst), false);
    assert.equal(mount.current.launch.target.value, kSecond);
    assert.deepEqual(history.recorded, [kSecond]);
    assert.equal(editorState(), "ready");

    mount.dispose();
    connection.dispose();
  });

  test("a back navigation during a switch wins over it without recording either", async() => {
    const mounted = Promise.withResolvers<void>();
    const { connection, history, mount } = await startMount(
      (target) => (target === kSecond ? mounted.promise : Promise.resolve())
    );

    const switching = mount.navigate(kSecond, null);
    await setImmediate();
    assert.equal(editorState(), "switching");
    history.back(kFirst);
    mounted.resolve();
    await switching;
    await untilReady();

    assert.equal(mount.current.launch.target.value, kFirst);
    assert.deepEqual(history.recorded, []);

    mount.dispose();
    connection.dispose();
  });

  test("a target that cannot open leaves the current editor running", async() => {
    const { connection, history, events, mount } = await startMount();

    await assert.rejects(
      mount.navigate("missing", null),
      AssetNotFoundError
    );

    assert.deepEqual(events, []);
    assert.equal(mount.current.launch.target.value, kFirst);
    assert.deepEqual(history.recorded, []);
    assert.equal(editorState(), "ready");

    mount.dispose();
    connection.dispose();
  });

  test("a switch whose mount fails reloads the page onto the requested target", async() => {
    const { connection, history, events, mount } = await startMount(
      (target) => (target === kSecond ?
        Promise.reject(new Error("mount failed")) :
        Promise.resolve())
    );

    await assert.rejects(
      mount.navigate(kSecond, null),
      /mount failed/
    );

    assert.equal(events.includes(`${kFirst} disposed`), true);
    assert.equal(connection.assets.has(kFirst), false);
    assert.equal(editorState(), "failed");
    assert.deepEqual(history.reloaded, [kSecond]);

    mount.dispose();
    connection.dispose();
  });
});
