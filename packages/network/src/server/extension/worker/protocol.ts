// Import Third-party Dependencies
import { Validator } from "ata-validator";

// Import Internal Dependencies
import {
  hostWorkerDataSchema,
  mainToWorkerSchema,
  workerToMainSchema
} from "./protocol.schema.ts";
import type { RoomPeer } from "../Extension.ts";
import type { PeerIdentity } from "../../auth/AuthenticationProvider.ts";

// CONSTANTS
const kValidatorOptions = { useDefaults: false };
const kHostWorkerData = new Validator(
  hostWorkerDataSchema,
  kValidatorOptions
);
const kMainToWorker = new Validator(
  mainToWorkerSchema,
  kValidatorOptions
);
const kWorkerToMain = new Validator(
  workerToMainSchema,
  kValidatorOptions
);

export interface DispatchArgsMap {
  onClientConnect: [clientId: string, peer: RoomPeer];
  onClientDisconnect: [clientId: string];
  onMessage: [clientId: string, payload: unknown];
}

export type DispatchMethod = keyof DispatchArgsMap;

export const DISPATCH_METHODS: DispatchMethod[] = [
  "onClientConnect",
  "onClientDisconnect",
  "onMessage"
];

export type WorkerDispatch = {
  [TMethod in DispatchMethod]: {
    type: "dispatch";
    id: string;
    method: TMethod;
    args: DispatchArgsMap[TMethod];
    identity: PeerIdentity;
  };
}[DispatchMethod];

export type MainToWorkerMessage = WorkerDispatch;

export interface WorkerReady {
  type: "ready";
  methods: DispatchMethod[];
}

export interface WorkerDispatchResult {
  type: "dispatch-result";
  id: string;
  ok: boolean;
  error?: string;
}

export interface ContextCallArgsMap {
  "room.broadcast": [payload: unknown];
  "client.send": [clientId: string, data: unknown];
}

export type ContextCallMethod = keyof ContextCallArgsMap;

export type WorkerContextCall = {
  [TMethod in ContextCallMethod]: {
    type: "context-call";
    method: TMethod;
    args: ContextCallArgsMap[TMethod];
  };
}[ContextCallMethod];

export type WorkerToMainMessage =
  | WorkerReady
  | WorkerDispatchResult
  | WorkerContextCall;

export interface HostWorkerData {
  id: string;
  modulePath: string;
  exportName?: string;
  extensionWorkerData?: unknown;
}

export function isHostWorkerData(
  value: unknown
): value is HostWorkerData {
  return kHostWorkerData.isValidObject(value);
}

export function isMainToWorkerMessage(
  value: unknown
): value is MainToWorkerMessage {
  return kMainToWorker.isValidObject(value);
}

export function isWorkerToMainMessage(
  value: unknown
): value is WorkerToMainMessage {
  return kWorkerToMain.isValidObject(value);
}
