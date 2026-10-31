// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import { launchElement } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { LaunchSource } from "#src/launch/sources/LaunchSource.ts";
import { InjectedLaunchSource } from "#src/launch/sources/InjectedLaunchSource.ts";
import { QueryLaunchSource } from "#src/launch/sources/QueryLaunchSource.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";
import { captureLogs } from "../helpers/logs.ts";
const kNothing: LaunchSource = {
  read: () => Promise.resolve(undefined)
};

function createLaunchSource(
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

describe("EditorLaunch", () => {
  afterEach(() => {
    document.head.replaceChildren();
    window.history.replaceState(null, "", "/");
  });

  describe("EditorLaunch.read", () => {
    test("returns the first defined launch in source order", async() => {
      const launch = await EditorLaunch.read([kNothing, createLaunchSource("a"), createLaunchSource("b")]);

      assert.equal(launch.target.value, "a");
    });

    test("throws LaunchNotFoundError when no source resolves", async() => {
      await assert.rejects(EditorLaunch.read([kNothing]), LaunchNotFoundError);
    });

    test("logs each source read until one answers", async() => {
      const { logger, metas } = captureLogs();

      await EditorLaunch.read([kNothing, createLaunchSource("a"), createLaunchSource("b")], logger);

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

    test("reads the target and credential of a share link page", async() => {
      document.head.insertAdjacentHTML("beforeend", launchElement({
        target: "map-1",
        credential: "</script>token"
      }));

      const launch = await new InjectedLaunchSource().read();

      assert.equal(launch?.target.value, "map-1");
      assert.equal(launch?.credential, "</script>token");
      assert.equal(EditorLaunch.parse({ target: "map-1" })?.credential, null);
      assert.equal(EditorLaunch.parse({ target: "map-1", credential: "" }), undefined);
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

    test("reads the viewed tag next to the target", async() => {
      window.history.replaceState(null, "", "/?target=abc&tag=v1");
      assert.equal((await new QueryLaunchSource().read())?.tag, "v1");

      window.history.replaceState(null, "", "/?target=abc&tag=");
      assert.equal((await new QueryLaunchSource().read())?.tag, null);
    });

    test("the URL of a launch keeps the other page parameters, such as offline", () => {
      const href = "http://editor.test/map/?offline&target=old&tag=v1";
      const launch = new EditorLaunch(new AssetId("new"));

      assert.deepEqual(
        [
          launch.toUrl(href),
          launch.viewing("v2").toUrl(href)
        ].map(String),
        [
          "http://editor.test/map/?offline=&target=new",
          "http://editor.test/map/?offline=&target=new&tag=v2"
        ]
      );
    });
  });
});
