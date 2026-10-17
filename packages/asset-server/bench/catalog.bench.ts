// Import Node.js Dependencies
import http from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import { CATALOG_URL_PATH } from "@jolly-pixel/asset";
import type { PeerIdentity } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  IDLE_SNAPSHOT,
  binaryAssetId,
  benchBackend,
  benchServer,
  connectPeer,
  joinRoom,
  leaveRoom,
  type BenchBackend
} from "./_fixtures.ts";
import {
  CATALOG_RENAME,
  CATALOG_ROOM,
  CATALOG_VIEW_ROOM,
  CatalogViewExtension
} from "../src/index.ts";
import { createCatalogHandler } from "../src/node.ts";

// CONSTANTS
const kAssetCounts = [100, 1_000, 10_000];
const kMembers = 10;
const kViews = 10;
const kViewerPrefix = "viewer-";

const suite = defineSuite("asset-server / catalog", async(bench) => {
  const fixtures: BenchBackend[] = [];
  const closers: (() => Promise<void>)[] = [];

  for (const assets of kAssetCounts) {
    const fixture = await benchBackend({
      assets,
      grids: 0,
      contentBytes: 64,
      snapshot: IDLE_SNAPSHOT
    });
    fixtures.push(fixture);
    const { backend } = fixture;
    const server = benchServer(backend);
    server.register(new CatalogViewExtension({
      catalog: backend.catalog,
      scope: viewerRoot
    }));
    closers.push(() => server.close());

    const joiner = connectPeer(server, "joiner");
    bench.add(`join snapshot [${assets} assets]`, async() => {
      await joinRoom(joiner, CATALOG_ROOM);
      await leaveRoom(joiner, CATALOG_ROOM);
    });

    const members = Array.from(
      { length: kMembers },
      (_, index) => connectPeer(server, `member-${index}`)
    );
    for (const member of members) {
      await joinRoom(member, CATALOG_ROOM);
    }
    for (let index = 0; index < kViews; index++) {
      await joinRoom(connectPeer(server, `${kViewerPrefix}${index}`), CATALOG_VIEW_ROOM);
    }

    const [author] = members;
    const assetId = binaryAssetId(0);
    let step = 0;
    bench.add(`rename [${assets} assets, ${kMembers} members, ${kViews} views]`, async() => {
      step++;
      await author.connection.receive(JSON.stringify({
        room: CATALOG_ROOM,
        kind: "message",
        payload: {
          type: CATALOG_RENAME,
          requestId: String(step),
          renames: [
            {
              assetId,
              to: `renamed/file-${step % 2}.bin`
            }
          ]
        }
      }));
      await backend.flush();
    });

    const httpServer = http.createServer((request, response) => {
      handler(request, response, () => {
        response.statusCode = 404;
        response.end();
      });
    });
    const handler = createCatalogHandler({ projection: backend.catalog });
    httpServer.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    closers.push(async() => {
      httpServer.close();
      await once(httpServer, "close");
    });
    const { port } = httpServer.address() as AddressInfo;
    const agent = new http.Agent({ keepAlive: true });
    closers.push(() => Promise.resolve(agent.destroy()));
    let etag: string | undefined;

    bench
      .add(`GET catalog [${assets} assets]`, () => get(port, agent))
      .add(`GET catalog 304 [${assets} assets]`, () => get(port, agent, etag), {
        beforeAll: async() => {
          etag = (await get(port, agent)).etag;
        }
      });
  }

  return async() => {
    for (const close of closers) {
      await close();
    }
    for (const fixture of fixtures) {
      await fixture[Symbol.asyncDispose]();
    }
  };
});

export default suite;

function viewerRoot(
  identity: PeerIdentity
): string | null {
  if (!identity.subject.startsWith(kViewerPrefix)) {
    return null;
  }

  const viewer = Number(identity.subject.slice(kViewerPrefix.length));

  return binaryAssetId(viewer * 10 + 9);
}

interface CatalogResponse {
  status: number;
  etag: string | undefined;
}

function get(
  port: number,
  agent: http.Agent,
  etag?: string
): Promise<CatalogResponse> {
  return new Promise((resolve, reject) => {
    const request = http.get({
      host: "127.0.0.1",
      port,
      path: CATALOG_URL_PATH,
      agent,
      headers: etag === undefined ? {} : { "if-none-match": etag }
    }, (response) => {
      response.resume();
      response.once("end", () => resolve({
        status: response.statusCode ?? 0,
        etag: response.headers.etag
      }));
    });
    request.once("error", reject);
  });
}

if (import.meta.main) {
  await runSuites([suite]);
}
