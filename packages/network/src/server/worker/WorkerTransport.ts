// Import Node.js Dependencies
import { Worker } from "node:worker_threads";

export interface WorkerTransport {
  postMessage(
    message: unknown
  ): void;

  onMessage(
    listener: (message: unknown) => void
  ): void;

  onError(
    listener: (error: Error) => void
  ): void;

  onExit(
    listener: (code: number) => void
  ): void;

  terminate(): Promise<number>;
}

export type WorkerTransportFactory = (
  workerData: unknown
) => WorkerTransport;

export class NodeWorkerTransport implements WorkerTransport {
  #worker: Worker;

  constructor(
    workerUrl: URL,
    workerData?: unknown
  ) {
    this.#worker = new Worker(workerUrl, {
      workerData
    });
  }

  postMessage(
    message: unknown
  ): void {
    this.#worker.postMessage(message);
  }

  onMessage(
    listener: (message: unknown) => void
  ): void {
    this.#worker.on("message", listener);
  }

  onError(
    listener: (error: Error) => void
  ): void {
    this.#worker.on("error", listener);
  }

  onExit(
    listener: (code: number) => void
  ): void {
    this.#worker.on("exit", listener);
  }

  terminate(): Promise<number> {
    return this.#worker.terminate();
  }
}
