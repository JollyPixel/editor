// Import Node.js Dependencies
import {
  createHistogram,
  performance,
  type EventLoopUtilization,
  type RecordableHistogram
} from "node:perf_hooks";
import {
  parentPort,
  workerData
} from "node:worker_threads";

// Import Internal Dependencies
import {
  LoadClient,
  type LoadLatencies
} from "./LoadClient.ts";
import {
  roomName,
  type DriverCommand,
  type DriverEvent,
  type DriverInit,
  type Workload
} from "./protocol.ts";
import { strokeCommand } from "../_fixtures.ts";

// CONSTANTS
const kTickMs = 2;

interface DriverClient {
  client: LoadClient;
  room: string;
  nextAt: number;
  step: number;
  busy: boolean;
}

class WorkloadSchedule {
  missed = 0;

  #workload: Workload;
  #clients: DriverClient[];
  #latencies: LoadLatencies;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    workload: Workload,
    clients: DriverClient[],
    latencies: LoadLatencies
  ) {
    this.#workload = workload;
    this.#clients = clients;
    this.#latencies = latencies;
  }

  start(
    offsets: readonly number[]
  ): void {
    const now = performance.now();
    for (const [index, entry] of this.#clients.entries()) {
      entry.nextAt = now + offsets[index];
    }
    this.#timer = setInterval(() => this.#tick(), kTickMs);
  }

  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  #tick(): void {
    const intervalMs = 1_000 / this.#workload.rate;
    const now = performance.now();
    for (const entry of this.#clients) {
      if (now < entry.nextAt) {
        continue;
      }

      entry.nextAt += intervalMs;
      if (now - entry.nextAt > intervalMs) {
        this.missed++;
        entry.nextAt = now + intervalMs;
      }
      if (!entry.busy) {
        this.#act(entry);
      }
    }
  }

  #act(
    entry: DriverClient
  ): void {
    const step = ++entry.step;
    switch (this.#workload.scenario) {
      case "presence":
        entry.client.send(presenceEnvelope(entry.room, step));
        break;
      case "command":
        entry.client.send(
          commandEnvelope(entry.room, step, this.#workload.variants)
        );
        break;
      default:
        entry.busy = true;
        void churn(entry, this.#latencies.own).finally(() => {
          entry.busy = false;
        });
    }
  }
}

const init: DriverInit = workerData;
const latencies: LoadLatencies = {
  own: createHistogram(),
  peer: createHistogram()
};
const clients: DriverClient[] = await Promise.all(
  init.clientIndices.map(async(index) => {
    return {
      client: await LoadClient.connect(init.url, latencies),
      room: roomName(index % init.workload.rooms),
      nextAt: 0,
      step: 0,
      busy: false
    };
  })
);
if (init.workload.scenario !== "churn") {
  await Promise.all(clients.map(({ client, room }) => client.join(room)));
}

const intervalMs = 1_000 / init.workload.rate;
const offsets = init.clientIndices.map(
  (index) => (index / init.totalClients) * intervalMs
);
const schedule = new WorkloadSchedule(init.workload, clients, latencies);
let elu: EventLoopUtilization = performance.eventLoopUtilization();

parentPort?.on("message", (command: DriverCommand) => {
  switch (command.type) {
    case "run":
      schedule.start(offsets);
      break;
    case "pause":
      schedule.stop();
      break;
    case "reset":
      reset();
      break;
    case "report":
      post(report());
      break;
    default:
      for (const { client } of clients) {
        client.close();
      }
      parentPort?.close();
  }
});
post({ type: "ready" });

function reset(): void {
  latencies.own.reset();
  latencies.peer.reset();
  schedule.missed = 0;
  elu = performance.eventLoopUtilization();
  for (const { client } of clients) {
    client.bytesReceived = 0;
    client.messagesReceived = 0;
    client.messagesSent = 0;
  }
}

function report(): DriverEvent {
  let sent = 0;
  let received = 0;
  let bytes = 0;
  for (const { client } of clients) {
    sent += client.messagesSent;
    received += client.messagesReceived;
    bytes += client.bytesReceived;
  }

  return {
    type: "report",
    report: {
      own: latencies.own,
      peer: latencies.peer,
      sent,
      received,
      bytes,
      missed: schedule.missed,
      elu: performance.eventLoopUtilization(elu).utilization
    }
  };
}

function post(
  event: DriverEvent
): void {
  parentPort?.postMessage(event);
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
  entry: DriverClient,
  histogram: RecordableHistogram
): Promise<void> {
  const sentAt = performance.now();
  await entry.client.join(entry.room);
  histogram.record(
    Math.max(1, Math.round((performance.now() - sentAt) * 1_000))
  );
  entry.client.leave(entry.room);
}
