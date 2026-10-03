// Import Internal Dependencies
import type {
  WorkerTransport,
  WorkerTransportFactory
} from "#src/server/extension/worker/WorkerTransport.ts";
import {
  isMainToWorkerMessage,
  type MainToWorkerMessage
} from "#src/server/extension/worker/protocol.ts";

/**
 * In-memory WorkerTransport double: no real thread, no real postMessage. Tests
 * drive the "worker" side by calling simulateMessage/simulateError/simulateExit
 * directly, and inspect what the proxy would have sent via `sent`.
 */
export class FakeWorkerTransport implements WorkerTransport {
  sent: unknown[] = [];
  terminated = false;

  #messageListeners: ((message: unknown) => void)[] = [];
  #errorListeners: ((error: Error) => void)[] = [];
  #exitListeners: ((code: number) => void)[] = [];

  postMessage(
    message: unknown
  ): void {
    this.sent.push(message);
  }

  dispatched(
    index = 0
  ): MainToWorkerMessage {
    const message = this.sent[index];
    if (!isMainToWorkerMessage(message)) {
      throw new Error(`Message ${index} is not a worker dispatch.`);
    }

    return message;
  }

  onMessage(
    listener: (message: unknown) => void
  ): void {
    this.#messageListeners.push(listener);
  }

  onError(
    listener: (error: Error) => void
  ): void {
    this.#errorListeners.push(listener);
  }

  onExit(
    listener: (code: number) => void
  ): void {
    this.#exitListeners.push(listener);
  }

  terminate(): Promise<number> {
    this.terminated = true;

    return Promise.resolve(0);
  }

  simulateMessage(
    message: unknown
  ): void {
    for (const listener of this.#messageListeners) {
      listener(message);
    }
  }

  simulateError(
    error: Error
  ): void {
    for (const listener of this.#errorListeners) {
      listener(error);
    }
  }

  simulateExit(
    code: number
  ): void {
    for (const listener of this.#exitListeners) {
      listener(code);
    }
  }
}

/**
 * Every spawn (including restarts) gets its own FakeWorkerTransport, collected
 * in `transports` in spawn order, so tests can assert on restart behavior.
 */
export function createFakeTransportFactory(): {
  factory: WorkerTransportFactory;
  transports: FakeWorkerTransport[];
} {
  const transports: FakeWorkerTransport[] = [];
  function factory(): FakeWorkerTransport {
    const transport = new FakeWorkerTransport();
    transports.push(transport);

    return transport;
  }

  return { factory, transports };
}
