// Import Node.js Dependencies
import { performance } from "node:perf_hooks";
import { workerData } from "node:worker_threads";

// Import Third-party Dependencies
import {
  LoadMeter,
  runLoadDriver,
  type LoadDriverInit
} from "@jolly-pixel/bench";
import { CATALOG_URL_PATH } from "@jolly-pixel/asset";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";

// Import Internal Dependencies
import { LoadClient } from "./LoadClient.ts";
import type { Workload } from "./protocol.ts";
import {
  binaryAssetId,
  gridAssetId,
  gridRoom,
  paintCommand
} from "../_fixtures.ts";
import {
  CATALOG_RENAME,
  CATALOG_ROOM
} from "../../src/catalog/client/protocol.ts";

interface DriverClient {
  client: LoadClient;
  index: number;
  room: string;
  step: number;
  etag: string | null;
}

const init: LoadDriverInit<Workload> = workerData;
const { workload } = init;
const url = `ws://127.0.0.1:${init.port}${DEFAULT_WEBSOCKET_PATH}`;
const catalogUrl = `http://127.0.0.1:${init.port}${CATALOG_URL_PATH}`;
const meter = new LoadMeter();

await runLoadDriver(init, {
  meter,
  connect,
  act,
  close: ({ client }) => client.close()
});

async function connect(
  index: number
): Promise<DriverClient> {
  const client = await LoadClient.connect(url, meter);
  const room = workload.scenario === "catalog" || workload.scenario === "join" ?
    CATALOG_ROOM :
    gridRoom(gridAssetId(index % workload.grids));
  if (workload.scenario === "edit" || workload.scenario === "catalog") {
    await client.join(room);
  }

  return {
    client,
    index,
    room,
    step: 0,
    etag: null
  };
}

function act(
  entry: DriverClient
): Promise<void> | void {
  const step = ++entry.step;
  if (workload.scenario === "edit") {
    entry.client.send({
      room: entry.room,
      kind: "message",
      payload: {
        ...paintCommand(step),
        sentAt: performance.now() + performance.timeOrigin
      }
    });

    return;
  }

  return exchange(entry, step);
}

async function exchange(
  entry: DriverClient,
  step: number
): Promise<void> {
  switch (workload.scenario) {
    case "catalog":
      await entry.client.request(entry.room, {
        type: CATALOG_RENAME,
        requestId: `${entry.index}-${step}`,
        renames: [
          {
            assetId: binaryAssetId(entry.index),
            to: `load/client-${entry.index}-${step % 2}.bin`
          }
        ]
      });
      break;
    case "http":
      await fetchCatalog(entry);
      break;
    default:
      await entry.client.join(entry.room);
      entry.client.leave(entry.room);
  }
}

async function fetchCatalog(
  entry: DriverClient
): Promise<void> {
  const response = await fetch(catalogUrl, {
    headers: workload.etag && entry.etag !== null ?
      { "if-none-match": entry.etag } :
      {}
  });
  const body = await response.arrayBuffer();
  entry.etag = response.headers.get("etag");
  meter.sent++;
  meter.received++;
  meter.bytes += body.byteLength;
}
