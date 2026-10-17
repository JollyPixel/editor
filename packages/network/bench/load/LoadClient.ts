// Import Node.js Dependencies
import type { RecordableHistogram } from "node:perf_hooks";

// Import Third-party Dependencies
import { WebSocket } from "ws";

// Import Internal Dependencies
import { WEBSOCKET_PROTOCOL } from "../../src/index.ts";

export interface LoadLatencies {
  own: RecordableHistogram;
  peer: RecordableHistogram;
}

interface IncomingEnvelope {
  room: string;
  kind: string;
  self?: string;
  patch?: {
    cursor?: {
      t?: number;
    };
  };
  payload?: {
    type?: string;
    data?: {
      clientId?: string;
      sentAt?: number;
    };
  };
}

export class LoadClient {
  static connect(
    url: string,
    latencies: LoadLatencies
  ): Promise<LoadClient> {
    const socket = new WebSocket(url, WEBSOCKET_PROTOCOL);

    return new Promise((resolve, reject) => {
      socket.once("open", () => resolve(new LoadClient(socket, latencies)));
      socket.once("error", reject);
    });
  }

  bytesReceived = 0;
  messagesReceived = 0;
  messagesSent = 0;

  #socket: WebSocket;
  #latencies: LoadLatencies;
  #self = new Map<string, string>();
  #joining = new Map<string, () => void>();

  constructor(
    socket: WebSocket,
    latencies: LoadLatencies
  ) {
    this.#socket = socket;
    this.#latencies = latencies;
    socket.on("message", (data: Buffer) => this.#receive(data));
  }

  join(
    room: string
  ): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.#joining.set(room, resolve);
    this.send({
      room,
      kind: "join"
    });

    return promise;
  }

  leave(
    room: string
  ): void {
    this.#self.delete(room);
    this.send({
      room,
      kind: "leave"
    });
  }

  send(
    envelope: object
  ): void {
    this.messagesSent++;
    this.#socket.send(JSON.stringify(envelope));
  }

  close(): void {
    this.#socket.terminate();
  }

  #receive(
    data: Buffer
  ): void {
    const now = performance.now() + performance.timeOrigin;
    this.bytesReceived += data.length;
    this.messagesReceived++;

    const envelope: IncomingEnvelope = JSON.parse(data.toString());
    if (envelope.kind === "sync") {
      this.#self.set(envelope.room, envelope.self ?? "");
    }
    else if (envelope.kind === "peer-presence") {
      this.#record(this.#latencies.peer, now, envelope.patch?.cursor?.t);
    }
    else if (envelope.kind === "message") {
      this.#receiveMessage(envelope, now);
    }
  }

  #receiveMessage(
    envelope: IncomingEnvelope,
    now: number
  ): void {
    const { payload } = envelope;
    if (payload?.type === "snapshot") {
      this.#joining.get(envelope.room)?.();
      this.#joining.delete(envelope.room);

      return;
    }
    if (payload?.type !== "command") {
      return;
    }

    const own = payload.data?.clientId === this.#self.get(envelope.room);
    this.#record(
      own ? this.#latencies.own : this.#latencies.peer,
      now,
      payload.data?.sentAt
    );
  }

  #record(
    histogram: RecordableHistogram,
    now: number,
    sentAt: number | undefined
  ): void {
    if (typeof sentAt === "number") {
      histogram.record(Math.max(1, Math.round((now - sentAt) * 1_000)));
    }
  }
}
