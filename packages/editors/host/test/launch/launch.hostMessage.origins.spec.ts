// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ANY_SHELL_ORIGIN, HostMessageLaunchSource } from "#src/launch/sources/HostMessageLaunchSource.ts";
import { LAUNCH_MESSAGE_TYPE } from "#src/launch/ShellChannel.ts";
import { captureLogs } from "../helpers/logs.ts";

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
