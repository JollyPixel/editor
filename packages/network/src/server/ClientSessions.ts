// Import Internal Dependencies
import type { ClientHandle } from "../protocol/types.ts";

export interface ClientSession {
  handle: ClientHandle;
  rooms: Set<string>;
}

/**
 * Tracks joined rooms and serializes dispatch per client and lane.
 */
export class ClientSessions {
  #sessions = new Map<string, ClientSession>();
  #queues = new Map<string, Map<string, Promise<void>>>();

  get size(): number {
    return this.#sessions.size;
  }

  get pending(): number {
    let total = 0;
    for (const lanes of this.#queues.values()) {
      total += lanes.size;
    }

    return total;
  }

  open(
    handle: ClientHandle
  ): void {
    this.#sessions.set(handle.id, {
      handle,
      rooms: new Set()
    });
  }

  get(
    clientId: string
  ): ClientSession | undefined {
    return this.#sessions.get(clientId);
  }

  close(
    clientId: string
  ): void {
    this.#sessions.delete(clientId);
  }

  clear(): void {
    this.#sessions.clear();
    this.#queues.clear();
  }

  enqueue(
    clientId: string,
    task: () => Promise<void>,
    lane = ""
  ): Promise<void> {
    let lanes = this.#queues.get(clientId);
    if (lanes === undefined) {
      lanes = new Map();
      this.#queues.set(clientId, lanes);
    }

    const previous = lanes.get(lane) ?? Promise.resolve();
    const next = previous.then(task, task);

    // Remove the tail only when no newer task has replaced it.
    const tail: Promise<void> = next
      .catch(() => void 0)
      .then(() => {
        if (lanes.get(lane) !== tail) {
          return;
        }
        lanes.delete(lane);
        if (
          lanes.size === 0 &&
          this.#queues.get(clientId) === lanes
        ) {
          this.#queues.delete(clientId);
        }
      });
    lanes.set(lane, tail);

    return next;
  }

  async drain(
    clientId: string
  ): Promise<void> {
    const lanes = this.#queues.get(clientId);
    if (lanes === undefined) {
      return;
    }

    await Promise.allSettled([
      ...lanes.values()
    ]);
  }
}
