// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import {
  DEFAULT_WEBSOCKET_PATH,
  WEBSOCKET_PROTOCOL
} from "@jolly-pixel/network";
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
import { LAUNCH_ELEMENT_ID } from "#src/launch.ts";
import type { AssetEventDataMap } from "#src/index.ts";

interface PluginHarness extends AsyncDisposable {
  transform(url: string): HtmlTagDescriptor[];
}

async function pluginHarness(
  options: Partial<AssetWorkspacePluginOptions>,
  httpServer: http.Server | null = null
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
    config: { server: { allowedHosts: [] } },
    httpServer
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

describe("createAssetWorkspacePlugin — WebSocket", () => {
  test("negotiates no compression by default", async() => {
    assert.strictEqual(await negotiatedExtensions({}), "");
  });

  test("forwards compression to the WebSocket transport", async() => {
    assert.match(
      await negotiatedExtensions({ compression: true }),
      /^permessage-deflate/
    );
  });
});

async function negotiatedExtensions(
  options: Partial<AssetWorkspacePluginOptions>
): Promise<string> {
  const httpServer = http.createServer();
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const { port } = httpServer.address() as AddressInfo;
  await using _harness = await pluginHarness(options, httpServer);

  const socket = new WebSocket(
    `ws://127.0.0.1:${port}${DEFAULT_WEBSOCKET_PATH}`,
    WEBSOCKET_PROTOCOL
  );
  const opened = Promise.withResolvers<Event>();
  socket.addEventListener("open", opened.resolve);
  socket.addEventListener("error", opened.reject);
  await opened.promise;
  const { extensions } = socket;
  socket.close();
  httpServer.closeAllConnections();
  httpServer.close();

  return extensions;
}
