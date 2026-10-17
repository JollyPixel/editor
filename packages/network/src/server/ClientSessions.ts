// Import Internal Dependencies
import type { ClientHandle } from "../transport/ClientHandle.ts";
import type { PeerIdentity } from "./auth/AuthenticationProvider.ts";
import type { PeerMetadata } from "../protocol/types.ts";

// CONSTANTS
const kSettled = Promise.resolve();

export interface ClientSession {
  handle: ClientHandle;
  identity: PeerIdentity;
  revoked: boolean;
}

export class ClientSessions {
  #sessions = new Map<string, ClientSession>();
  #queues = new Map<string, Map<string, Promise<void>>>();

  get pending(): number {
    let total = 0;
    for (const lanes of this.#queues.values()) {
      total += lanes.size;
    }

    return total;
  }

  open(
    handle: ClientHandle,
    identity: PeerIdentity
  ): void {
    this.#sessions.set(handle.id, {
      handle,
      identity,
      revoked: false
    });
  }

  revoke(
    subject: string
  ): ClientHandle[] {
    const handles: ClientHandle[] = [];
    for (const session of this.#sessions.values()) {
      if (session.identity.subject === subject) {
        session.revoked = true;
        handles.push(session.handle);
      }
    }

    return handles;
  }

  updateProfile(
    subject: string,
    patch: PeerMetadata
  ): string[] {
    const clientIds: string[] = [];
    for (const session of this.#sessions.values()) {
      if (session.identity.subject === subject) {
        session.identity = {
          ...session.identity,
          profile: {
            ...session.identity.profile,
            ...patch
          }
        };
        clientIds.push(session.handle.id);
      }
    }

    return clientIds;
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
    if (this.#queues.get(clientId)?.size === 0) {
      this.#queues.delete(clientId);
    }
  }

  clear(): void {
    this.#sessions.clear();
    this.#queues.clear();
  }

  enqueue(
    clientId: string,
    task: () => Promise<void>,
    lane: string
  ): Promise<void> {
    let lanes = this.#queues.get(clientId);
    if (lanes === undefined) {
      lanes = new Map();
      this.#queues.set(clientId, lanes);
    }

    const next = (lanes.get(lane) ?? kSettled).then(task);

    const settle = (): void => {
      if (lanes.get(lane) !== tail) {
        return;
      }
      lanes.delete(lane);
      if (
        lanes.size === 0 &&
        !this.#sessions.has(clientId) &&
        this.#queues.get(clientId) === lanes
      ) {
        this.#queues.delete(clientId);
      }
    };
    const tail: Promise<void> = next.then(settle, settle);
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
