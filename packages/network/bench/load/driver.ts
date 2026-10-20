// Import Node.js Dependencies
import { performance } from "node:perf_hooks";
import { workerData } from "node:worker_threads";

// Import Third-party Dependencies
import {
  LoadMeter,
  runLoadDriver,
  type LoadDriverInit
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { LoadClient } from "./LoadClient.ts";
import {
  roomName,
  type Workload
} from "./protocol.ts";
import { strokeCommand } from "../_fixtures.ts";
import { DEFAULT_WEBSOCKET_PATH } from "../../src/index.ts";

interface DriverClient {
  client: LoadClient;
  room: string;
  step: number;
}

const init: LoadDriverInit<Workload> = workerData;
const { workload } = init;
const url = `ws://127.0.0.1:${init.port}${DEFAULT_WEBSOCKET_PATH}`;
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
  const room = roomName(index % workload.rooms);
  if (workload.scenario !== "churn") {
    await client.join(room);
  }

  return {
    client,
    room,
    step: 0
  };
}

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
  await entry.client.join(entry.room);
  entry.client.leave(entry.room);
}

function act(
  entry: DriverClient
): Promise<void> | void {
  const step = ++entry.step;
  switch (workload.scenario) {
    case "presence":
      entry.client.send(presenceEnvelope(entry.room, step));

      return;
    case "command":
      entry.client.send(
        commandEnvelope(entry.room, step, workload.variants)
      );

      return;
    default:
      return churn(entry);
  }
}
