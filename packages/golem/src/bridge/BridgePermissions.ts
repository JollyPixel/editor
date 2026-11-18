// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import type {
  PermissionOption,
  RequestPermissionRequest,
  RequestPermissionResponse
} from "@agentclientprotocol/sdk";
import {
  AGENT_BRIDGE_OPTIONS_MAX_LENGTH,
  AGENT_BRIDGE_PERMISSIONS_MAX_LENGTH,
  AGENT_BRIDGE_TITLE_MAX_LENGTH,
  type AgentBridgePermission
} from "@jolly-pixel/server";

// CONSTANTS
const kDefaultTitle = "Use a tool";
const kCancelled: RequestPermissionResponse = {
  outcome: {
    outcome: "cancelled"
  }
};

interface PendingPermission {
  permission: AgentBridgePermission;
  options: readonly PermissionOption[];
  settle: (response: RequestPermissionResponse) => void;
}

export class BridgePermissions {
  #pending = new Map<string, PendingPermission>();
  #changed: () => void;

  constructor(
    changed: () => void
  ) {
    this.#changed = changed;
  }

  get pending(): AgentBridgePermission[] {
    return Array.from(this.#pending.values(), ({ permission }) => permission);
  }

  ask(
    request: RequestPermissionRequest,
    signal: AbortSignal
  ): Promise<RequestPermissionResponse> {
    if (
      signal.aborted ||
      this.#pending.size >= AGENT_BRIDGE_PERMISSIONS_MAX_LENGTH ||
      request.options.length === 0 ||
      request.options.length > AGENT_BRIDGE_OPTIONS_MAX_LENGTH
    ) {
      return Promise.resolve(kCancelled);
    }

    const id = randomUUID();
    const { promise, resolve } = Promise.withResolvers<
      RequestPermissionResponse
    >();
    const settle = (response: RequestPermissionResponse): void => {
      signal.removeEventListener("abort", abort);
      if (this.#pending.delete(id)) {
        resolve(response);
        this.#changed();
      }
    };
    function abort(): void {
      settle(kCancelled);
    }
    signal.addEventListener("abort", abort, { once: true });
    this.#pending.set(id, {
      permission: {
        id,
        title: clipBridgeTitle(request.toolCall.title ?? kDefaultTitle),
        options: request.options.map((option, index) => {
          return {
            optionId: String(index),
            name: clipBridgeTitle(option.name),
            kind: option.kind
          };
        })
      },
      options: request.options,
      settle
    });
    this.#changed();

    return promise;
  }

  answer(
    id: string,
    optionId: string
  ): void {
    const pending = this.#pending.get(id);
    const index = pending?.permission.options.findIndex(
      (option) => option.optionId === optionId
    ) ?? -1;
    const option = pending?.options[index];
    if (pending === undefined || option === undefined) {
      return;
    }

    pending.settle({
      outcome: {
        outcome: "selected",
        optionId: option.optionId
      }
    });
  }

  cancelAll(): void {
    for (const { settle } of Array.from(this.#pending.values())) {
      settle(kCancelled);
    }
  }
}

export function clipBridgeTitle(
  text: string
): string {
  return text.length > AGENT_BRIDGE_TITLE_MAX_LENGTH ?
    `${text.slice(0, AGENT_BRIDGE_TITLE_MAX_LENGTH - 1)}…` :
    text;
}
