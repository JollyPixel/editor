// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { LaunchSource } from "#src/launch/sources/LaunchSource.ts";
import {
  ANY_SHELL_ORIGIN,
  LAUNCH_MESSAGE_TYPE,
  HostMessageLaunchSource
} from "#src/launch/sources/HostMessageLaunchSource.ts";
import {
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE
} from "#src/launch/ShellChannel.ts";
import { InjectedLaunchSource } from "#src/launch/sources/InjectedLaunchSource.ts";
import { QueryLaunchSource } from "#src/launch/sources/QueryLaunchSource.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";
import { captureLogs } from "../helpers/logs.ts";

// CONSTANTS
const kStudioOrigin = "http://studio.test";
const kNothing: LaunchSource = {
  read: () => Promise.resolve(undefined)
};

function launchOf(
  target: string
): LaunchSource {
  return {
    read: () => Promise.resolve(new EditorLaunch(new AssetId(target)))
  };
}

function injectLaunchElement(
  id: string,
  text: string
): void {
  const element = document.createElement("script");
  element.type = "application/json";
  element.id = id;
  element.textContent = text;
  document.head.append(element);
}

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

describe("EditorLaunch.read", () => {
  test("returns the first defined launch in source order", async() => {
    const launch = await EditorLaunch.read([kNothing, launchOf("a"), launchOf("b")]);

    assert.equal(launch.target.value, "a");
  });

  test("throws LaunchNotFoundError when no source resolves", async() => {
    await assert.rejects(EditorLaunch.read([kNothing]), LaunchNotFoundError);
  });

  test("logs each source read until one answers", async() => {
    const { logger, metas } = captureLogs();

    await EditorLaunch.read([kNothing, launchOf("a"), launchOf("b")], logger);

    assert.deepEqual(
      metas.map((meta) => [meta?.index, meta?.target]),
      [[0, null], [1, "a"]]
    );
  });
});

describe("EditorLaunch.parse", () => {
  test("accepts a non-empty string target only", () => {
    assert.equal(EditorLaunch.parse({ target: "x" })?.target.value, "x");
    assert.equal(EditorLaunch.parse({ target: " x " })?.target.value, " x ");
    assert.equal(EditorLaunch.parse({ target: "x", extra: true })?.target.value, "x");
    assert.equal(EditorLaunch.parse({ target: " " }), undefined);
    assert.equal(EditorLaunch.parse({ target: 1 }), undefined);
    assert.equal(EditorLaunch.parse(null), undefined);
    assert.equal(EditorLaunch.fromTarget(" "), undefined);
    assert.equal(EditorLaunch.fromTarget(null), undefined);
  });
});

describe("InjectedLaunchSource", () => {
  test("reads the JSON launch element", async() => {
    injectLaunchElement("jolly-launch", JSON.stringify({ target: "world-1" }));

    const launch = await new InjectedLaunchSource().read();

    assert.equal(launch?.target.value, "world-1");
  });

  test("ignores a missing element or malformed JSON", async() => {
    assert.equal(await new InjectedLaunchSource().read(), undefined);

    injectLaunchElement("custom", "{not json");
    assert.equal(await new InjectedLaunchSource("custom").read(), undefined);
  });
});

describe("QueryLaunchSource", () => {
  test("reads ?target= or a custom parameter", async() => {
    window.history.replaceState(null, "", "/?target=abc&world=def");

    const launch = await new QueryLaunchSource().read();
    assert.equal(launch?.target.value, "abc");
    assert.equal(launch?.shell, null);
    assert.equal((await new QueryLaunchSource("world").read())?.target.value, "def");
    assert.equal(await new QueryLaunchSource("asset").read(), undefined);
  });
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

    launch?.shell?.openAsset("tileset-1");

    assert.deepEqual(parent.posted, [
      {
        message: {
          type: SHELL_MESSAGE_TYPE,
          command: "open-asset",
          target: "tileset-1"
        },
        origin: kStudioOrigin
      }
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

  test("ignores a launch from an origin outside the allow-list", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));
    const { logger, lines } = captureLogs();

    const pending = new HostMessageLaunchSource({
      origins: [kStudioOrigin],
      logger
    }).read();
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      origin: "http://evil.test",
      data: { type: LAUNCH_MESSAGE_TYPE, target: "hijacked" }
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      origin: kStudioOrigin,
      data: { type: LAUNCH_MESSAGE_TYPE, target: "from-host" }
    }));

    const launch = await pending;
    assert.equal(launch?.target.value, "from-host");
    assert.deepEqual(lines, [
      "[DEBUG] [root] ready posted",
      "[WARN] [root] launch rejected",
      "[DEBUG] [root] launch accepted"
    ]);
  });

  test("accepts any origin once ANY_SHELL_ORIGIN is allowed", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));

    const pending = new HostMessageLaunchSource({
      origins: [ANY_SHELL_ORIGIN]
    }).read();
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      origin: "http://anywhere.test",
      data: { type: LAUNCH_MESSAGE_TYPE, target: "from-host" }
    }));

    const launch = await pending;
    assert.deepEqual(
      parent.posted.map(({ origin }) => origin),
      [ANY_SHELL_ORIGIN]
    );
    assert.equal(launch?.shell?.origin, "http://anywhere.test");
  });

  test("gives up after the timeout", async(context) => {
    context.after(frameIn(fakeParent()));
    context.mock.timers.enable({ apis: ["setTimeout"] });

    const pending = new HostMessageLaunchSource({ timeout: 50 }).read();
    context.mock.timers.tick(50);

    assert.equal(await pending, undefined);
  });
});
