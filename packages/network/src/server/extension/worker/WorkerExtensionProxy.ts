// Import Third-party Dependencies
import { match } from "ts-pattern";

// Import Internal Dependencies
import {
  Extension,
  type RoomBroadcast,
  type RoomContext,
  type RoomEventStoreHandle,
  type WorkerExtensionDescriptor,
  type RoomPeer
} from "../Extension.ts";
import type { Logger } from "../../logger.ts";
import { errorMessage } from "../../errors.ts";
import {
  PendingCallRegistry,
  PendingCallTimeoutError
} from "./PendingCallRegistry.ts";
import {
  NodeWorkerTransport,
  type WorkerTransport,
  type WorkerTransportFactory
} from "./WorkerTransport.ts";
import {
  isWorkerToMainMessage,
  type DispatchArgsMap,
  type DispatchMethod,
  type HostWorkerData,
  type WorkerContextCall,
  type WorkerContextResponse,
  type WorkerToMainMessage
} from "./protocol.ts";
import type { MessageProtocols } from "../../../protocol/MessageProtocol.ts";
import type { ClientHandle } from "../../../protocol/types.ts";

// CONSTANTS
const kDefaultRpcTimeoutMs = 10_000;
const kDefaultMaxRestarts = 5;
const kDefaultRestartWindowMs = 60_000;

export interface WorkerExtensionProxyOptions {
  logger: Logger;
  transportFactory?: WorkerTransportFactory;
}

function resolveHostEntryUrl(): URL {
  // Static URLs stop bundlers from globbing sibling .d.ts and .map files.
  return import.meta.url.endsWith(".ts") ?
    new URL("./WorkerExtensionHost.ts", import.meta.url) :
    new URL("./WorkerExtensionHost.js", import.meta.url);
}

/**
 * Presents a worker-hosted extension through the normal Extension API.
 */
export class WorkerExtensionProxy extends Extension {
  readonly id: string;
  readonly name: string;
  readonly protocols: MessageProtocols;

  #descriptor: WorkerExtensionDescriptor;
  #logger: Logger;
  #transportFactory: WorkerTransportFactory;
  #transport: WorkerTransport | undefined;

  #readyPromise!: Promise<void>;
  #implemented: Set<DispatchMethod> | undefined;
  #resolveReady: (() => void) | undefined;
  #rejectReady: ((error: Error) => void) | undefined;

  #dead = false;
  #dispatchCalls = new PendingCallRegistry<void>();
  #dispatchChain: Promise<void> = Promise.resolve();
  #restartTimestamps: number[] = [];
  #roomBroadcast: RoomBroadcast | undefined;
  #currentEventStore: RoomEventStoreHandle | undefined;

  constructor(
    descriptor: WorkerExtensionDescriptor,
    options: WorkerExtensionProxyOptions
  ) {
    super();
    this.id = descriptor.id;
    this.name = descriptor.name;
    this.protocols = descriptor.protocols;
    this.#descriptor = descriptor;
    this.#logger = options.logger.withContext({
      room: descriptor.id
    });
    this.#transportFactory = options.transportFactory ??
      ((workerData) => new NodeWorkerTransport(resolveHostEntryUrl(), workerData));

    this.#spawn();
  }

  override onClientConnect(
    client: ClientHandle,
    peer: RoomPeer,
    context: RoomContext
  ): Promise<void> {
    return this.#dispatch(
      "onClientConnect",
      [client.id, peer],
      context
    );
  }

  override onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): Promise<void> {
    return this.#dispatch(
      "onClientDisconnect",
      [clientId],
      context
    );
  }

  override onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): Promise<void> {
    return this.#dispatch(
      "onMessage",
      [clientId, payload],
      context
    );
  }

  async close(): Promise<void> {
    this.#dead = true;
    await this.#transport?.terminate();
  }

  #spawn(): void {
    const hostData: HostWorkerData = {
      id: this.#descriptor.id,
      modulePath: String(this.#descriptor.modulePath),
      exportName: this.#descriptor.exportName,
      extensionWorkerData: this.#descriptor.workerData
    };

    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.#implemented = undefined;
    this.#readyPromise = promise;
    this.#resolveReady = resolve;
    this.#rejectReady = reject;

    const transport = this.#transportFactory(hostData);
    this.#transport = transport;
    transport.onMessage((message) => {
      if (isWorkerToMainMessage(message)) {
        this.#handleWorkerMessage(message);
      }
    });
    transport.onError((error) => this.#handleFailure(error));
    transport.onExit((code) => {
      // `close()` sets `#dead`, so nonzero termination codes are not crashes.
      if (code !== 0 && !this.#dead) {
        this.#handleFailure(new Error(`worker exited with code ${code}`));
      }
    });
  }

  #dispatch<TMethod extends DispatchMethod>(
    method: TMethod,
    args: DispatchArgsMap[TMethod],
    context: RoomContext
  ): Promise<void> {
    const run = (): Promise<void> => this.#dispatchNow(method, args, context);
    const result = this.#dispatchChain.then(run, run);

    this.#dispatchChain = result.catch(() => void 0);

    return result;
  }

  async #dispatchNow<TMethod extends DispatchMethod>(
    method: TMethod,
    args: DispatchArgsMap[TMethod],
    context: RoomContext
  ): Promise<void> {
    if (this.#dead) {
      this.#logger
        .withMetadata({
          method,
          outcome: "dropped",
          reason: "extension dead"
        })
        .warn("worker dispatch");

      return;
    }

    await this.#readyPromise;

    if (this.#implemented?.has(method) === false) {
      return;
    }

    this.#roomBroadcast ??= context.room;
    this.#currentEventStore = context.eventStore;

    const timeoutMs = this.#descriptor.rpcTimeoutMs ?? kDefaultRpcTimeoutMs;
    const { id: dispatchId, promise } = this.#dispatchCalls.create({
      timeoutMs,
      timeoutMessage: `worker dispatch "${method}" timed out after ${timeoutMs}ms`
    });

    this.#transport?.postMessage({
      type: "dispatch",
      id: dispatchId,
      method,
      args
    });

    try {
      await promise;
    }
    catch (error) {
      if (error instanceof PendingCallTimeoutError) {
        this.#handleFailure(error);
      }
      throw error;
    }
  }

  #handleWorkerMessage(
    message: WorkerToMainMessage
  ): void {
    match(message)
      .with({ type: "ready" }, (message) => {
        this.#implemented = new Set(message.methods);
        this.#resolveReady?.();
      })
      .with({ type: "dispatch-result" }, (message) => {
        if (message.ok) {
          this.#dispatchCalls.resolve(message.id, undefined);
        }
        else {
          this.#dispatchCalls.reject(
            message.id,
            new Error(message.error ?? "worker dispatch failed")
          );
        }
      })
      .with({ type: "context-call" }, (message) => {
        this.#handleContextCall(message);
      })
      .exhaustive();
  }

  #handleContextCall(
    call: WorkerContextCall
  ): void {
    match(call)
      .with({ method: "room.broadcast" }, (call) => {
        const [payload] = call.args;
        this.#roomBroadcast?.broadcast(payload);
      })
      .with({ method: "client.send" }, (call) => {
        const [clientId, data] = call.args;
        this.#roomBroadcast?.sendTo(clientId, data);
      })
      .with({ method: "eventStore.append" }, (call) => {
        const [input] = call.args;
        void this.#replyToContextCall(
          call.id,
          this.#currentEventStore?.append(input) ?? Promise.resolve(false)
        );
      })
      .with({ method: "eventStore.list" }, (call) => {
        const [assetId, fromVersion] = call.args;
        void this.#replyToContextCall(
          call.id,
          this.#currentEventStore?.list(assetId, fromVersion) ?? Promise.resolve([])
        );
      })
      .exhaustive();
  }

  async #replyToContextCall(
    id: string | undefined,
    valuePromise: Promise<unknown>
  ): Promise<void> {
    if (id === undefined) {
      return;
    }

    let response: WorkerContextResponse;
    try {
      const value = await valuePromise;
      response = {
        type: "context-response",
        id,
        ok: true,
        value
      };
    }
    catch (error) {
      response = {
        type: "context-response",
        id,
        ok: false,
        error: errorMessage(error)
      };
    }

    this.#transport?.postMessage(response);
  }

  #handleFailure(
    error: Error
  ): void {
    this.#logger.withError(error).error("worker failure");

    this.#rejectReady?.(error);
    this.#dispatchCalls.rejectAll(error);

    void this.#transport?.terminate();
    this.#transport = undefined;

    if (this.#dead) {
      return;
    }

    const windowMs = this.#descriptor.restartWindowMs ?? kDefaultRestartWindowMs;
    const maxRestarts = this.#descriptor.maxRestarts ?? kDefaultMaxRestarts;
    const now = Date.now();
    this.#restartTimestamps = this.#restartTimestamps.filter(
      (timestamp) => now - timestamp < windowMs
    );
    this.#restartTimestamps.push(now);

    if (this.#restartTimestamps.length > maxRestarts) {
      this.#dead = true;
      this.#logger
        .withMetadata({ maxRestarts, windowMs })
        .error("extension marked dead after exceeding restart cap");

      return;
    }

    this.#spawn();
  }
}
