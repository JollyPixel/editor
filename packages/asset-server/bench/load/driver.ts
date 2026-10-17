// Import Node.js Dependencies
import { performance } from "node:perf_hooks";
import { workerData } from "node:worker_threads";

// Import Third-party Dependencies
import {
  LoadMeter,
  recordLatency,
  runLoadDriver,
  type LoadDriverInit,
  type PacedEntry
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

interface DriverClient extends PacedEntry {
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
const clients: DriverClient[] = await Promise.all(
  init.clientIndices.map(async(index) => {
    return {
      client: await LoadClient.connect(url, meter),
      index,
      room: workload.scenario === "catalog" || workload.scenario === "join" ?
        CATALOG_ROOM :
        gridRoom(gridAssetId(index % workload.grids)),
      nextAt: 0,
      step: 0,
      busy: false,
      etag: null
    };
  })
);
if (workload.scenario === "edit" || workload.scenario === "catalog") {
  await Promise.all(clients.map(({ client, room }) => client.join(room)));
}

runLoadDriver(init, {
  meter,
  entries: clients,
  act,
  close: () => {
    for (const { client } of clients) {
      client.close();
    }
  }
});

function act(
  entry: DriverClient
): void {
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

  entry.busy = true;
  const startedAt = performance.now();
  void exchange(entry, step).then(() => {
    recordLatency(meter.own, startedAt, performance.now());
  }).finally(() => {
    entry.busy = false;
  });
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
