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

// Import Internal Dependencies
import { LoadClient } from "./LoadClient.ts";
import {
  roomName,
  type Workload
} from "./protocol.ts";
import { strokeCommand } from "../_fixtures.ts";
import { DEFAULT_WEBSOCKET_PATH } from "../../src/index.ts";

interface DriverClient extends PacedEntry {
  client: LoadClient;
  room: string;
  step: number;
}

const init: LoadDriverInit<Workload> = workerData;
const { workload } = init;
const url = `ws://127.0.0.1:${init.port}${DEFAULT_WEBSOCKET_PATH}`;
const meter = new LoadMeter();
const clients: DriverClient[] = await Promise.all(
  init.clientIndices.map(async(index) => {
    return {
      client: await LoadClient.connect(url, meter),
      room: roomName(index % workload.rooms),
      nextAt: 0,
      step: 0,
      busy: false
    };
  })
);
if (workload.scenario !== "churn") {
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

function presenceEnvelope(
  room: string,
  step: number
): object {
  return {
    room,
    kind: "presence",
    patch: {
      cursor: {
        x: step % 512,
        y: (step * 7) % 512,
        t: performance.now() + performance.timeOrigin
      }
    }
  };
}

function commandEnvelope(
  room: string,
  step: number,
  variants: number
): object {
  return {
    room,
    kind: "message",
    payload: {
      ...strokeCommand(step % variants, step),
      sentAt: performance.now() + performance.timeOrigin
    }
  };
}

async function churn(
  entry: DriverClient
): Promise<void> {
  const sentAt = performance.now();
  await entry.client.join(entry.room);
  recordLatency(meter.own, sentAt, performance.now());
  entry.client.leave(entry.room);
}

function act(
  entry: DriverClient
): void {
  const step = ++entry.step;
  switch (workload.scenario) {
    case "presence":
      entry.client.send(presenceEnvelope(entry.room, step));
      break;
    case "command":
      entry.client.send(
        commandEnvelope(entry.room, step, workload.variants)
      );
      break;
    default:
      entry.busy = true;
      void churn(entry).finally(() => {
        entry.busy = false;
      });
  }
}
