// Import Internal Dependencies
import type { RoomContext } from "#src/index.ts";
import type { WorkerExtensionDescriptor } from "#src/node.ts";
import {
  DISPATCH_METHODS,
  type DispatchMethod,
  type WorkerReady
} from "#src/server/extension/worker/protocol.ts";
import { OPAQUE_PROTOCOLS } from "../protocol/protocols.ts";

export function readyMessage(
  methods: DispatchMethod[] = DISPATCH_METHODS
): WorkerReady {
  return {
    type: "ready",
    methods
  };
}

export function createContext(): RoomContext {
  return {
    room: {
      broadcast: () => void 0,
      sendTo: () => void 0
    },
    identity: {
      subject: "client-1",
      role: "default"
    }
  };
}

export function createDescriptor(
  overrides: Partial<WorkerExtensionDescriptor> = {}
): WorkerExtensionDescriptor {
  return {
    id: "room-1",
    name: "ext",
    protocols: OPAQUE_PROTOCOLS,
    modulePath: "irrelevant.js",
    ...overrides
  };
}
