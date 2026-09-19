// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import { LAUNCH_ELEMENT_ID } from "@jolly-pixel/asset";
import type {
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  Plugin,
  ViteDevServer
} from "vite";

// Import Internal Dependencies
import {
  createAssetWorkspacePlugin,
  type AssetLaunchRequest,
  type AssetWorkspacePluginOptions
} from "#src/plugins/vite.ts";
import type { AssetEventDataMap } from "#src/index.ts";

interface PluginHarness extends AsyncDisposable {
  transform(url: string): HtmlTagDescriptor[];
}

async function pluginHarness(
  options: Partial<AssetWorkspacePluginOptions>
): Promise<PluginHarness> {
  const eventStore = EventStore.persistence.memory<AssetEventDataMap>();
  const source = new MemoryAssetSource();
  await source.write("maps/a.png", new Uint8Array([1]));

  const plugin: Plugin = createAssetWorkspacePlugin({
    root: "unused",
    source,
    eventStore,
    ...options
  });
  const devServer = {
    middlewares: { use: () => undefined },
    httpServer: null
  };
  await callHook(plugin.configureServer, devServer as unknown as ViteDevServer);

  return {
    transform(url) {
      const context = {
        path: url.split("?")[0],
        filename: "index.html",
        originalUrl: url
      } satisfies IndexHtmlTransformContext;
      const result = callHook(plugin.transformIndexHtml, "<html></html>", context);

      return Array.isArray(result) ? result : [];
    },
    async [Symbol.asyncDispose]() {
      await callHook(plugin.closeBundle);
      eventStore.close();
    }
  };
}

function callHook(
  hook: unknown,
  ...parameters: unknown[]
): unknown {
  const handler = typeof hook === "function" ?
    hook :
    (hook as { handler?: unknown; } | undefined)?.handler;

  return typeof handler === "function" ?
    handler.call({}, ...parameters) :
    undefined;
}

describe("createAssetWorkspacePlugin — launch", () => {
  test("injects the launch target as a JSON script", async() => {
    const requests: AssetLaunchRequest[] = [];
    await using harness = await pluginHarness({
      launch: (request) => {
        requests.push(request);

        return request.url.searchParams.get("open") ?? undefined;
      }
    });

    assert.deepEqual(harness.transform("/?open=map-1"), [
      {
        tag: "script",
        attrs: {
          type: "application/json",
          id: LAUNCH_ELEMENT_ID
        },
        children: "{\"target\":\"map-1\"}",
        injectTo: "head"
      }
    ]);
    assert.strictEqual(requests[0].url.pathname, "/");
    assert.strictEqual(requests[0].catalog.size, 1);
  });

  test("injects nothing when launch returns undefined", async() => {
    await using harness = await pluginHarness({
      launch: () => undefined
    });

    assert.deepEqual(harness.transform("/"), []);
  });

  test("injects nothing without a launch option", async() => {
    await using harness = await pluginHarness({});

    assert.deepEqual(harness.transform("/"), []);
  });

  test("escapes markup in the target", async() => {
    await using harness = await pluginHarness({
      launch: () => "</script><script>"
    });

    const [tag] = harness.transform("/");
    assert.strictEqual(typeof tag.children, "string");
    assert.doesNotMatch(String(tag.children), /</);
    assert.deepEqual(JSON.parse(String(tag.children)), {
      target: "</script><script>"
    });
  });
});
