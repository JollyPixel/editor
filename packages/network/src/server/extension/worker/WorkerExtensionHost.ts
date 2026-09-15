// Import Node.js Dependencies
import {
  parentPort,
  workerData
} from "node:worker_threads";

// Import Third-party Dependencies
import { match } from "ts-pattern";

// Import Internal Dependencies
import type {
  Extension,
  RoomContext
} from "../Extension.ts";
import type {
  ClientHandle
} from "../../../protocol/types.ts";
import type { PeerIdentity } from "../../auth/AuthenticationProvider.ts";
import { createLogger } from "../../logger.ts";
import {
  DISPATCH_METHODS,
  isHostWorkerData,
  isMainToWorkerMessage,
  type ContextCallMethod,
  type WorkerDispatch,
  type WorkerDispatchResult,
  type WorkerReady
} from "./protocol.ts";

if (!parentPort) {
  throw new Error("WorkerExtensionHost must run inside a worker_threads.Worker");
}
if (!isHostWorkerData(workerData)) {
  throw new Error("WorkerExtensionHost received malformed workerData");
}

const port = parentPort;
const {
  id, modulePath, exportName, extensionWorkerData
} = workerData;
const logger = createLogger(id).withContext({
  room: id
});

function postContextCall(
  method: ContextCallMethod,
  args: unknown[]
): void {
  port.postMessage({ type: "context-call", method, args });
}

function createContext(
  identity: PeerIdentity
): RoomContext {
  return {
    room: {
      broadcast: (payload) => postContextCall("room.broadcast", [payload]),
      sendTo: (clientId, payload) => postContextCall("client.send", [clientId, payload])
    },
    identity
  };
}

function createClientHandle(
  clientId: string
): ClientHandle {
  return {
    id: clientId,
    send: (data) => postContextCall("client.send", [clientId, data])
  };
}

async function dispatch(
  extension: Extension,
  message: WorkerDispatch
): Promise<void> {
  await match(message)
    .with({ method: "onClientConnect" }, (message) => {
      const [clientId, peer] = message.args;

      return extension.onClientConnect?.(
        createClientHandle(clientId),
        peer,
        createContext(message.identity)
      );
    })
    .with({ method: "onClientDisconnect" }, (message) => {
      const [clientId] = message.args;

      return extension.onClientDisconnect?.(
        clientId,
        createContext(message.identity)
      );
    })
    .with({ method: "onMessage" }, (message) => {
      const [clientId, payload] = message.args;

      return extension.onMessage?.(
        clientId,
        payload,
        createContext(message.identity)
      );
    })
    .exhaustive();
}

// Preserve Worker startup errors.
const mod = await import(modulePath);
const Ctor = mod[exportName ?? "default"];
const extension: Extension = new Ctor(extensionWorkerData);

port.on("message", (message: unknown) => {
  if (!isMainToWorkerMessage(message)) {
    return;
  }

  dispatch(extension, message)
    .then(() => {
      const result: WorkerDispatchResult = {
        type: "dispatch-result",
        id: message.id,
        ok: true
      };
      port.postMessage(result);
    })
    .catch((error: Error) => {
      logger.withError(error).error("dispatch failed");
      const result: WorkerDispatchResult = {
        type: "dispatch-result",
        id: message.id,
        ok: false,
        error: error.message
      };
      port.postMessage(result);
    });
});

const ready: WorkerReady = {
  type: "ready",
  methods: DISPATCH_METHODS.filter(
    (method) => typeof extension[method] === "function"
  )
};
port.postMessage(ready);
