// Import Internal Dependencies
import { SchemaParser } from "../../../protocol/SchemaParser.ts";
import {
  hostWorkerDataSchema,
  mainToWorkerSchema,
  workerToMainSchema
} from "./protocol.schema.ts";
import type { RoomPeer } from "../Extension.ts";
import type { PeerIdentity } from "../../auth/AuthenticationProvider.ts";

// CONSTANTS
const kHostWorkerData = new SchemaParser(hostWorkerDataSchema);
const kMainToWorker = new SchemaParser(mainToWorkerSchema);
const kWorkerToMain = new SchemaParser(workerToMainSchema);

export interface DispatchArgsMap {
  onClientConnect: [clientId: string, peer: RoomPeer];
  onClientDisconnect: [clientId: string];
  onResync: [clientId: string];
  onMessage: [clientId: string, payload: unknown];
}

export type DispatchMethod = keyof DispatchArgsMap;

export const DISPATCH_METHODS: DispatchMethod[] = [
  "onClientConnect",
  "onClientDisconnect",
  "onResync",
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
  return kHostWorkerData.is(value);
}

export function isMainToWorkerMessage(
  value: unknown
): value is MainToWorkerMessage {
  return kMainToWorker.is(value);
}

export function isWorkerToMainMessage(
  value: unknown
): value is WorkerToMainMessage {
  return kWorkerToMain.is(value);
}
