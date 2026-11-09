// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ShellCatalog } from "#src/shell/catalog/ShellCatalog.ts";
import { HostMessageLaunchSource } from "#src/launch/sources/HostMessageLaunchSource.ts";
import {
  fakeParent,
  frameIn,
  postFromParent
} from "../helpers/parentFrame.ts";
import { SHELL_ORIGIN } from "../helpers/shell.ts";

describe("HostMessageLaunchSource", () => {
  afterEach(() => {
    document.head.replaceChildren();
    window.history.replaceState(null, "", "/");
  });

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
      origins: [SHELL_ORIGIN]
    }).read();
    assert.deepEqual(parent.posted, [
      {
        message: { type: "jolly-ready" },
        origin: SHELL_ORIGIN
      }
    ]);

    window.dispatchEvent(new MessageEvent("message", {
      source: window,
      data: { type: "jolly-launch", target: "ignored" }
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      data: { type: "other", target: "ignored" }
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      data: { type: "jolly-launch", target: 1 }
    }));
    postFromParent(parent, { type: "jolly-launch", target: "from-host" });

    const launch = await pending;
    assert.equal(launch?.target.value, "from-host");
    assert.equal(launch?.shell?.origin, SHELL_ORIGIN);
    assert.equal(launch?.shell?.identity, null);
  });

  test("hands the launch identity to the shell channel", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));

    const pending = new HostMessageLaunchSource({
      origins: [SHELL_ORIGIN]
    }).read();
    postFromParent(parent, {
      type: "jolly-launch",
      target: "from-host",
      identity: {
        username: "alice",
        peerId: "peer-alice"
      }
    });
    const launch = await pending;

    assert.equal(launch?.shell?.identity?.username, "alice");
    assert.equal(launch?.shell?.identity?.peerId, "peer-alice");
  });

  test("answers the parent through the shell channel", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));

    const pending = new HostMessageLaunchSource({
      origins: [SHELL_ORIGIN]
    }).read();
    postFromParent(parent, { type: "jolly-launch", target: "from-host" });
    const launch = await pending;
    parent.posted.length = 0;

    launch?.shell?.openAsset("blockset-1");
    launch?.shell?.toggleConsole();

    assert.deepEqual(parent.posted, [
      {
        message: {
          type: "jolly-open-asset",
          target: "blockset-1"
        },
        origin: SHELL_ORIGIN
      },
      {
        message: {
          type: "jolly-toggle-console"
        },
        origin: SHELL_ORIGIN
      }
    ]);
  });

  test("keeps the launch reveal for the editor's listener", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));

    const pending = new HostMessageLaunchSource({
      origins: [SHELL_ORIGIN]
    }).read();
    postFromParent(parent, {
      type: "jolly-launch",
      target: "from-host",
      reveal: "object:spawn"
    });
    const launch = await pending;
    const received: string[] = [];
    launch?.shell?.onReveal((key) => received.push(key), new AbortController().signal);

    assert.deepEqual(received, ["object:spawn"]);
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
        origins: [SHELL_ORIGIN]
      }).read();
      postFromParent(parent, { type: "jolly-launch", target: "from-host", ports });
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
        origins: [SHELL_ORIGIN]
      }).read();
      postFromParent(parent, { type: "jolly-launch", target: "from-host", appearance });
      const launch = await pending;
      assert.equal(launch?.target.value, "from-host");
      const received: unknown[] = [];
      launch?.shell?.onAppearance(
        (current) => received.push(current),
        new AbortController().signal
      );
      appearances.push(received);
    }

    assert.deepEqual(appearances, [
      [{ theme: "light", density: "compact" }],
      [],
      []
    ]);
  });

  test("hides the page until the launch shows it in the launch appearance", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));
    const scope = document.createElement("jolly-scope");
    scope.setAttribute("theme", "dark");
    scope.setAttribute("density", "comfortable");
    document.body.append(scope);
    context.after(() => scope.remove());

    const pending = new HostMessageLaunchSource({
      origins: [SHELL_ORIGIN]
    }).read();
    const hidden = document.documentElement.style.visibility;
    postFromParent(parent, {
      type: "jolly-launch",
      target: "from-host",
      appearance: { theme: "light", density: "default" }
    });
    await pending;

    assert.deepEqual(
      [
        hidden,
        document.documentElement.style.visibility,
        scope.getAttribute("theme"),
        scope.getAttribute("density")
      ],
      ["hidden", "", "light", "default"]
    );
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
      origins: [SHELL_ORIGIN, "http://other.test", SHELL_ORIGIN]
    }).read();
    context.mock.timers.tick(50);
    await pending;

    assert.deepEqual(
      parent.posted.map(({ origin }) => origin),
      [SHELL_ORIGIN, "http://other.test"]
    );
  });
});
