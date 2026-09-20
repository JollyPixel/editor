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
  LAUNCH_MESSAGE_TYPE,
  HostMessageLaunchSource
} from "#src/launch/sources/HostMessageLaunchSource.ts";
import { InjectedLaunchSource } from "#src/launch/sources/InjectedLaunchSource.ts";
import { QueryLaunchSource } from "#src/launch/sources/QueryLaunchSource.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";

// CONSTANTS
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
});

describe("EditorLaunch.parse", () => {
  test("accepts a non-empty string target only", () => {
    assert.equal(EditorLaunch.parse({ target: "x" })?.target.value, "x");
    assert.equal(EditorLaunch.parse({ target: " " }), undefined);
    assert.equal(EditorLaunch.parse({ target: 1 }), undefined);
    assert.equal(EditorLaunch.parse(null), undefined);
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

    assert.equal((await new QueryLaunchSource().read())?.target.value, "abc");
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

  test("takes the launch posted by the parent window", async(context) => {
    const parent = new MessageChannel().port1;
    context.after(frameIn(parent));

    const pending = new HostMessageLaunchSource().read();
    window.dispatchEvent(new MessageEvent("message", {
      source: window,
      data: { type: LAUNCH_MESSAGE_TYPE, target: "ignored" }
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: parent,
      data: { type: LAUNCH_MESSAGE_TYPE, target: "from-host" }
    }));

    assert.equal((await pending)?.target.value, "from-host");
  });

  test("gives up after the timeout", async(context) => {
    context.after(frameIn(new MessageChannel().port1));
    context.mock.timers.enable({ apis: ["setTimeout"] });

    const pending = new HostMessageLaunchSource({ timeout: 50 }).read();
    context.mock.timers.tick(50);

    assert.equal(await pending, undefined);
  });
});
