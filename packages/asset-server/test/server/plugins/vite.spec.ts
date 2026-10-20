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
  ASSET_URL_PREFIX,
  CATALOG_URL_PATH
} from "@jolly-pixel/asset";
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
  createAssetServerPlugin,
  type AssetLaunchRequest,
  type AssetServerPluginOptions
} from "#src/server/plugins/vite.ts";
import { LAUNCH_ELEMENT_ID } from "#src/launch.ts";
import type { AssetEventDataMap } from "#src/index.ts";

type Middleware = (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  next: () => void
) => void;

interface PluginHarness extends AsyncDisposable {
  transform(url: string): HtmlTagDescriptor[];
  fetchStatus(path: string): Promise<number>;
}

async function pluginHarness(
  options: Partial<AssetServerPluginOptions>,
  httpServer: http.Server | null = null
): Promise<PluginHarness> {
  const eventStore = EventStore.persistence.memory<AssetEventDataMap>();
  const source = new MemoryAssetSource();
  await source.write("maps/a.png", new Uint8Array([1]));

  const plugin: Plugin = createAssetServerPlugin({
    root: "unused",
    source,
    eventStore,
    ...options
  });
  const middlewares: Middleware[] = [];
  const devServer = {
    middlewares: {
      use: (middleware: Middleware) => middlewares.push(middleware)
    },
    config: { server: { allowedHosts: [] } },
    httpServer
  };
  await callHook(plugin.configureServer, devServer as unknown as ViteDevServer);

  return {
    async fetchStatus(path) {
      const server = http.createServer((request, response) => {
        const chain = middlewares.values();
        function next(): void {
          const middleware = chain.next().value;
          if (middleware === undefined) {
            response.statusCode = 404;
            response.end();

            return;
          }
          middleware(request, response, next);
        }
        next();
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const { port } = server.address() as AddressInfo;
      try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`);
        await response.arrayBuffer();

        return response.status;
      }
      finally {
        server.closeAllConnections();
        server.close();
      }
    },
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

describe("createAssetServerPlugin — launch", () => {
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

describe("createAssetServerPlugin — HTTP routes", () => {
  test("serves the catalog and the asset files by default", async() => {
    await using harness = await pluginHarness({});

    assert.strictEqual(await harness.fetchStatus(CATALOG_URL_PATH), 200);
    assert.strictEqual(
      await harness.fetchStatus(`${ASSET_URL_PREFIX}maps/a.png`),
      200
    );
  });

  test("serves neither route with http: false", async() => {
    await using harness = await pluginHarness({ http: false });

    assert.strictEqual(await harness.fetchStatus(CATALOG_URL_PATH), 404);
    assert.strictEqual(
      await harness.fetchStatus(`${ASSET_URL_PREFIX}maps/a.png`),
      404
    );
  });
});

describe("createAssetServerPlugin — WebSocket", () => {
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
  options: Partial<AssetServerPluginOptions>
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
