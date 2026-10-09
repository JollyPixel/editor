// Import Third-party Dependencies
import {
  Extension,
  type ClientHandle,
  type MessageProtocols,
  type RoomBroadcast,
  type RoomContext,
  type RoomPeer
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AccountDirectory } from "../AccountDirectory.ts";
import { Username } from "../account/Username.ts";
import { AccountChangeRefusedError } from "../account/errors/AccountChangeRefusedError.ts";
import { InvalidUsernameError } from "../account/errors/InvalidUsernameError.ts";
import {
  ACCOUNTS_APPLIED,
  ACCOUNTS_APPROVE,
  ACCOUNTS_ASSIGN_ROLE,
  ACCOUNTS_DENY,
  ACCOUNTS_REJECTED,
  ACCOUNTS_REMOVE,
  ACCOUNTS_ROOM,
  ACCOUNTS_ROSTER,
  ACCOUNTS_TRANSFER_OWNERSHIP,
  type AccountsCommand,
  type AccountsMessage
} from "./protocol.ts";
import { accountsProtocols } from "./protocol.schema.ts";

export class AccountsExtension extends Extension<AccountsCommand> {
  readonly id = ACCOUNTS_ROOM;
  readonly name = ACCOUNTS_ROOM;
  readonly protocols: MessageProtocols = accountsProtocols;

  #directory: AccountDirectory;
  #members = new Map<string, string>();
  #room: RoomBroadcast | null = null;

  constructor(
    directory: AccountDirectory
  ) {
    super();
    this.#directory = directory;
    this.#directory.on("changed", this.#broadcastRoster);
  }

  override onClientConnect(
    _client: ClientHandle,
    peer: RoomPeer,
    context: RoomContext
  ): void {
    this.#room = context.room;
    this.#members.set(
      peer.clientId,
      context.identity.subject
    );
    this.#broadcastRoster();
  }

  override onClientDisconnect(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    if (this.#members.size === 0) {
      this.#room = null;
    }
    this.#broadcastRoster();
  }

  override onMessage(
    clientId: string,
    command: AccountsCommand,
    context: RoomContext
  ): void {
    context.room.sendTo(
      clientId,
      this.#reply(command, context)
    );
  }

  override dispose(): void {
    this.#directory.off("changed", this.#broadcastRoster);
    this.#members.clear();
    this.#room = null;
  }

  #reply(
    command: AccountsCommand,
    context: RoomContext
  ): AccountsMessage {
    try {
      this.#apply(
        command,
        context.identity.subject
      );

      return {
        type: ACCOUNTS_APPLIED,
        requestId: command.requestId
      };
    }
    catch (error) {
      if (
        error instanceof AccountChangeRefusedError ||
        error instanceof InvalidUsernameError
      ) {
        return {
          type: ACCOUNTS_REJECTED,
          requestId: command.requestId,
          reason: error.message
        };
      }

      throw error;
    }
  }

  #apply(
    command: AccountsCommand,
    actorId: string
  ): void {
    const username = Username.parse(command.username);
    switch (command.type) {
      case ACCOUNTS_ASSIGN_ROLE:
        this.#directory.assignRole(
          actorId,
          username,
          command.role
        );
        break;
      case ACCOUNTS_APPROVE:
        this.#directory.approve(
          actorId,
          username,
          command.role
        );
        break;
      case ACCOUNTS_DENY:
        this.#directory.deny(
          actorId,
          username
        );
        break;
      case ACCOUNTS_REMOVE:
        this.#directory.remove(
          actorId,
          username
        );
        break;
      case ACCOUNTS_TRANSFER_OWNERSHIP:
        this.#directory.transferOwnership(
          actorId,
          username
        );
        break;
    }
  }

  readonly #broadcastRoster = (): void => {
    const room = this.#room;
    if (room === null) {
      return;
    }

    const online = new Set(this.#members.values());
    const roles = [...this.#directory.roles];
    const accounts = Array.from(this.#directory, (account) => {
      return {
        ...account,
        online: online.has(account.id)
      };
    });
    const requests = [...this.#directory.requests()];
    for (const [clientId, accountId] of this.#members) {
      room.sendTo(clientId, {
        type: ACCOUNTS_ROSTER,
        roles,
        accounts,
        requests: this.#directory.isAdmin(accountId) ? requests : []
      });
    }
  };
}
