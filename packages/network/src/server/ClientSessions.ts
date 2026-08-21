// Import Internal Dependencies
import type { ClientHandle } from "../protocol/types.ts";

export interface ClientSession {
  handle: ClientHandle;
  rooms: Set<string>;
}

/**
 * Tracks joined rooms and serializes dispatch per client.
 */
export class ClientSessions {
  #sessions = new Map<string, ClientSession>();
  #queues = new Map<string, Promise<void>>();

  get size(): number {
    return this.#sessions.size;
  }

  get pending(): number {
    return this.#queues.size;
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

  /**
   * Runs a client's tasks in order, even after a prior task fails.
   */
  enqueue(
    clientId: string,
    task: () => Promise<void>
  ): Promise<void> {
    const previous = this.#queues.get(
      clientId
    ) ?? Promise.resolve();
    const next = previous.then(task, task);

    // Remove the tail only when no newer task has replaced it.
    const tail: Promise<void> = next
      .catch(() => void 0)
      .then(() => {
        if (this.#queues.get(clientId) === tail) {
          this.#queues.delete(clientId);
        }
      });
    this.#queues.set(clientId, tail);

    return next;
  }
}
