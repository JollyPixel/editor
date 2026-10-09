// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  Room,
  RoomRejectionEvent
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { AccessRequest } from "../account/Account.ts";
import { AccountsRejectedError } from "./errors/AccountsRejectedError.ts";
import {
  ACCOUNTS_APPROVE,
  ACCOUNTS_ASSIGN_ROLE,
  ACCOUNTS_DENY,
  ACCOUNTS_REJECTED,
  ACCOUNTS_REMOVE,
  ACCOUNTS_ROOM,
  ACCOUNTS_ROSTER,
  ACCOUNTS_TRANSFER_OWNERSHIP,
  type AccountsCommand,
  type AccountsMessage,
  type AccountsRequest,
  type RosterEntry
} from "./protocol.ts";

export type AccountsRoom = Room<AccountsCommand, AccountsMessage>;

export interface AccountsRoomSource {
  room(
    name: string
  ): AccountsRoom;
}

export type AccountsRosterEventMap = {
  change: () => void;
};

interface Pending {
  resolve: () => void;
  reject: (error: Error) => void;
}

export class AccountsRoster extends Emitter<
  AccountsRosterEventMap
> implements Iterable<RosterEntry> {
  static join(
    rooms: AccountsRoomSource
  ): AccountsRoster {
    return new AccountsRoster(
      rooms.room(ACCOUNTS_ROOM)
    );
  }

  #room: AccountsRoom;
  #roles: readonly string[] = [];
  #entries: readonly RosterEntry[] = [];
  #requests: readonly AccessRequest[] = [];
  #pending = new Map<string, Pending>();
  #ready = Promise.withResolvers<void>();

  constructor(
    room: AccountsRoom
  ) {
    super();
    this.#room = room;
    this.#room.on("message", this.#onMessage);
    this.#room.on("denied", this.#onDenied);
    this.#room.join();
  }

  get ready(): Promise<void> {
    return this.#ready.promise;
  }

  get roles(): readonly string[] {
    return this.#roles;
  }

  get requests(): readonly AccessRequest[] {
    return this.#requests;
  }

  [Symbol.iterator](): IterableIterator<RosterEntry> {
    return this.#entries.values();
  }

  assignRole(
    username: string,
    role: string
  ): Promise<void> {
    return this.#request({
      type: ACCOUNTS_ASSIGN_ROLE,
      username,
      role
    });
  }

  approve(
    username: string,
    role: string
  ): Promise<void> {
    return this.#request({
      type: ACCOUNTS_APPROVE,
      username,
      role
    });
  }

  deny(
    username: string
  ): Promise<void> {
    return this.#request({
      type: ACCOUNTS_DENY,
      username
    });
  }

  remove(
    username: string
  ): Promise<void> {
    return this.#request({
      type: ACCOUNTS_REMOVE,
      username
    });
  }

  transferOwnership(
    username: string
  ): Promise<void> {
    return this.#request({
      type: ACCOUNTS_TRANSFER_OWNERSHIP,
      username
    });
  }

  dispose(): void {
    this.#room.off("message", this.#onMessage);
    this.#room.off("denied", this.#onDenied);
    this.#room.leave();
    this.#rejectAll("accounts roster disposed");
  }

  #request(
    request: AccountsRequest
  ): Promise<void> {
    const requestId = crypto.randomUUID();
    const {
      promise,
      resolve,
      reject
    } = Promise.withResolvers<void>();

    this.#pending.set(requestId, {
      resolve,
      reject
    });
    this.#room.send({
      ...request,
      requestId
    });

    return promise;
  }

  #rejectAll(
    reason: string
  ): void {
    for (const pending of this.#pending.values()) {
      pending.reject(
        new AccountsRejectedError(reason)
      );
    }
    this.#pending.clear();
  }

  readonly #onMessage = (
    message: AccountsMessage
  ): void => {
    if (message.type === ACCOUNTS_ROSTER) {
      this.#roles = message.roles;
      this.#entries = message.accounts;
      this.#requests = message.requests;
      this.#ready.resolve();
      this.emit("change");

      return;
    }

    const pending = this.#pending.get(message.requestId);
    this.#pending.delete(message.requestId);
    if (message.type === ACCOUNTS_REJECTED) {
      pending?.reject(
        new AccountsRejectedError(message.reason)
      );
    }
    else {
      pending?.resolve();
    }
  };

  readonly #onDenied = (
    event: RoomRejectionEvent
  ): void => {
    this.#rejectAll(event.reason);
  };
}
