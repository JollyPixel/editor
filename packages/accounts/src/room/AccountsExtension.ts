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
import { ADMIN_ROLE } from "../account/Account.ts";
import type { Accounts } from "../Accounts.ts";
import { Username } from "../account/Username.ts";
import { AccountChangeRefusedError } from "../store/errors/AccountChangeRefusedError.ts";
import { InvalidUsernameError } from "../account/errors/InvalidUsernameError.ts";
import {
  ACCOUNTS_APPLIED,
  ACCOUNTS_ASSIGN_ROLE,
  ACCOUNTS_REJECTED,
  ACCOUNTS_REMOVE,
  ACCOUNTS_ROOM,
  ACCOUNTS_ROSTER,
  type AccountsCommand,
  type AccountsMessage,
  type AccountsRosterMessage
} from "./protocol.ts";
import { accountsProtocols } from "./protocol.schema.ts";

export class AccountsExtension extends Extension<AccountsCommand> {
  readonly id = ACCOUNTS_ROOM;
  readonly name = ACCOUNTS_ROOM;
  readonly protocols: MessageProtocols = accountsProtocols;

  #accounts: Accounts;
  #members = new Map<string, string>();
  #room: RoomBroadcast | null = null;

  constructor(
    accounts: Accounts
  ) {
    super();
    this.#accounts = accounts;
    this.#accounts.on("changed", this.#broadcastRoster);
  }

  override onClientConnect(
    _client: ClientHandle,
    peer: RoomPeer,
    context: RoomContext
  ): void {
    this.#room = context.room;
    this.#members.set(peer.clientId, context.identity.subject);
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
    context.room.sendTo(clientId, this.#reply(command, context));
  }

  override dispose(): void {
    this.#accounts.off("changed", this.#broadcastRoster);
    this.#members.clear();
    this.#room = null;
  }

  #reply(
    command: AccountsCommand,
    context: RoomContext
  ): AccountsMessage {
    try {
      const sender = this.#accounts.accountById(context.identity.subject);
      if (sender?.role !== ADMIN_ROLE) {
        throw new AccountChangeRefusedError("only an admin manages accounts");
      }
      this.#apply(command);

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
    command: AccountsCommand
  ): void {
    const username = Username.parse(command.username);
    switch (command.type) {
      case ACCOUNTS_ASSIGN_ROLE:
        this.#accounts.assignRole(username, command.role);
        break;
      case ACCOUNTS_REMOVE:
        this.#accounts.remove(username);
        break;
    }
  }

  #roster(): AccountsRosterMessage {
    const online = new Set(this.#members.values());

    return {
      type: ACCOUNTS_ROSTER,
      roles: [...this.#accounts.roles],
      accounts: Array.from(this.#accounts, (account) => {
        return {
          ...account,
          online: online.has(account.id)
        };
      })
    };
  }

  readonly #broadcastRoster = (): void => {
    this.#room?.broadcast(this.#roster());
  };
}
