// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ShellCatalog } from "#src/launch/catalog/ShellCatalog.ts";
import { HostMessageLaunchSource } from "#src/launch/sources/HostMessageLaunchSource.ts";
import {
  LAUNCH_MESSAGE_TYPE,
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE
} from "#src/launch/ShellChannel.ts";

// CONSTANTS
const kStudioOrigin = "http://studio.test";

type FakeParent = MessagePort & {
  posted: Array<{
    message: unknown;
    origin: string;
  }>;
};

function fakeParent(): FakeParent {
  const posted: FakeParent["posted"] = [];

  return Object.assign(new MessageChannel().port1, {
    posted,
    postMessage(
      message: unknown,
      origin: string
    ): void {
      posted.push({
        message,
        origin
      });
    }
  });
}

function frameIn(
  parent: MessageEventSource
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(window, "parent");
  Object.defineProperty(window, "parent", {
    configurable: true,
    get: () => parent
  });

  return () => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(window, "parent");
    }
    else {
      Object.defineProperty(window, "parent", descriptor);
    }
  };
}

afterEach(() => {
  document.head.replaceChildren();
  window.history.replaceState(null, "", "/");
});

describe("HostMessageLaunchSource", () => {
  test("resolves nothing at once outside a frame", async() => {
    assert.equal(
      await new HostMessageLaunchSource({ timeout: 10_000 }).read(),
      undefined
    );
  });

  test("posts ready and takes the launch posted by the parent window", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));

    const pending = new HostMessageLaunchSource({
      origins: [kStudioOrigin]
    }).read();
    assert.deepEqual(parent.posted, [
      {
        message: { type: READY_MESSAGE_TYPE },
        origin: kStudioOrigin
      }
    ]);

    window.dispatchEvent(new MessageEvent("message", {
      source: window,
      data: { type: LAUNCH_MESSAGE_TYPE, target: "ignored" }
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      data: { type: "other", target: "ignored" }
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      data: { type: LAUNCH_MESSAGE_TYPE, target: 1 }
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      origin: kStudioOrigin,
      data: { type: LAUNCH_MESSAGE_TYPE, target: "from-host" }
    }));

    const launch = await pending;
    assert.equal(launch?.target.value, "from-host");
    assert.equal(launch?.shell?.origin, kStudioOrigin);
    assert.equal(launch?.shell?.identity, null);
  });

  test("hands the launch identity to the shell channel", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));

    const pending = new HostMessageLaunchSource({
      origins: [kStudioOrigin]
    }).read();
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      origin: kStudioOrigin,
      data: {
        type: LAUNCH_MESSAGE_TYPE,
        target: "from-host",
        identity: {
          username: "alice",
          peerId: "peer-alice"
        }
      }
    }));
    const launch = await pending;

    assert.equal(launch?.shell?.identity?.username, "alice");
    assert.equal(launch?.shell?.identity?.peerId, "peer-alice");
  });

  test("answers the parent through the shell channel", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));

    const pending = new HostMessageLaunchSource({
      origins: [kStudioOrigin]
    }).read();
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      origin: kStudioOrigin,
      data: { type: LAUNCH_MESSAGE_TYPE, target: "from-host" }
    }));
    const launch = await pending;
    parent.posted.length = 0;

    launch?.shell?.openAsset("blockset-1");
    launch?.shell?.toggleConsole();

    assert.deepEqual(parent.posted, [
      {
        message: {
          type: SHELL_MESSAGE_TYPE,
          command: "open-asset",
          target: "blockset-1"
        },
        origin: kStudioOrigin
      },
      {
        message: {
          type: SHELL_MESSAGE_TYPE,
          command: "toggle-console"
        },
        origin: kStudioOrigin
      }
    ]);
  });

  test("gives the shell channel the ports the launch carries", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));
    const catalog = new MessageChannel();
    const consolePorts = new MessageChannel();
    context.after(() => {
      catalog.port1.close();
      consolePorts.port1.close();
    });
    const launches = [
      { catalog: catalog.port2 },
      { catalog: catalog.port2, console: consolePorts.port2 },
      { console: consolePorts.port2 },
      undefined
    ];
    const received: Array<[boolean, boolean]> = [];

    for (const ports of launches) {
      const pending = new HostMessageLaunchSource({
        origins: [kStudioOrigin]
      }).read();
      window.dispatchEvent(new MessageEvent("message", {
        source: parent,
        origin: kStudioOrigin,
        data: { type: LAUNCH_MESSAGE_TYPE, target: "from-host", ports }
      }));
      const shell = (await pending)?.shell;
      received.push([
        shell?.catalog instanceof ShellCatalog,
        shell?.console === consolePorts.port2
      ]);
    }

    assert.deepEqual(received, [
      [true, false],
      [true, true],
      [false, true],
      [false, false]
    ]);
  });

  test("gives the shell channel a valid launch appearance only", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));
    const appearances: unknown[] = [];

    for (const appearance of [
      { theme: "light", density: "compact" },
      { theme: "pink", density: "compact" },
      undefined
    ]) {
      const pending = new HostMessageLaunchSource({
        origins: [kStudioOrigin]
      }).read();
      window.dispatchEvent(new MessageEvent("message", {
        source: parent,
        origin: kStudioOrigin,
        data: { type: LAUNCH_MESSAGE_TYPE, target: "from-host", appearance }
      }));
      const launch = await pending;
      assert.equal(launch?.target.value, "from-host");
      appearances.push(launch?.shell?.appearance);
    }

    assert.deepEqual(appearances, [
      { theme: "light", density: "compact" },
      null,
      null
    ]);
  });

  test("posts ready to its own origin by default", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));
    context.mock.timers.enable({ apis: ["setTimeout"] });

    const pending = new HostMessageLaunchSource({ timeout: 50 }).read();
    context.mock.timers.tick(50);
    await pending;

    assert.deepEqual(
      parent.posted.map(({ origin }) => origin),
      [location.origin]
    );
  });

  test("posts ready once per allowed origin", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));
    context.mock.timers.enable({ apis: ["setTimeout"] });

    const pending = new HostMessageLaunchSource({
      timeout: 50,
      origins: [kStudioOrigin, "http://other.test", kStudioOrigin]
    }).read();
    context.mock.timers.tick(50);
    await pending;

    assert.deepEqual(
      parent.posted.map(({ origin }) => origin),
      [kStudioOrigin, "http://other.test"]
    );
  });
});
