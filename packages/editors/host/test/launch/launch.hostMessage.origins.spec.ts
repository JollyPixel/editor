// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ANY_SHELL_ORIGIN, HostMessageLaunchSource } from "#src/launch/sources/HostMessageLaunchSource.ts";
import { captureLogs } from "../helpers/logs.ts";
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

  test("ignores a launch from an origin outside the allow-list", async(context) => {
    const parent = fakeParent();
    context.after(frameIn(parent));
    const { logger, lines } = captureLogs();

    const pending = new HostMessageLaunchSource({
      origins: [SHELL_ORIGIN],
      logger
    }).read();
    postFromParent(
      parent,
      { type: "jolly-launch", target: "hijacked" },
      "http://evil.test"
    );
    postFromParent(parent, { type: "jolly-launch", target: "from-host" });

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
    postFromParent(
      parent,
      { type: "jolly-launch", target: "from-host" },
      "http://anywhere.test"
    );

    const launch = await pending;
    assert.deepEqual(
      parent.posted.map(({ origin }) => origin),
      [ANY_SHELL_ORIGIN]
    );
    assert.equal(launch?.shell?.origin, "http://anywhere.test");
  });

  test("gives up after the timeout and shows the hidden page", async(context) => {
    context.after(frameIn(fakeParent()));
    context.mock.timers.enable({ apis: ["setTimeout"] });

    const pending = new HostMessageLaunchSource({ timeout: 50 }).read();
    const waiting = document.documentElement.style.visibility;
    context.mock.timers.tick(50);

    assert.equal(await pending, undefined);
    assert.deepEqual(
      [waiting, document.documentElement.style.visibility],
      ["hidden", ""]
    );
  });
});
