// Import Internal Dependencies
import type { MessageProtocols } from "../../../protocol/MessageProtocol.ts";

export interface WorkerExtensionDescriptor {
  id: string;
  name: string;
  protocols: MessageProtocols;
  modulePath: string | URL;
  exportName?: string;
  workerData?: unknown;
  rpcTimeoutMs?: number;
  maxRestarts?: number;
  restartWindowMs?: number;
}
