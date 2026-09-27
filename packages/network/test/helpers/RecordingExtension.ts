// Import Internal Dependencies
import {
  Extension,
  type ClientHandle,
  type MessageProtocols,
  type RoomContext,
  type RoomPeer
} from "#src/index.ts";
import { OPAQUE_PROTOCOLS } from "./protocols.ts";

export interface RecordedMessage {
  clientId: string;
  payload: unknown;
}

export class RecordingExtension extends Extension {
  readonly id: string;
  readonly name: string;
  readonly protocols: MessageProtocols;
  readonly clients: ClientHandle[] = [];
  readonly disconnected: string[] = [];
  readonly messages: RecordedMessage[] = [];
  readonly contexts: RoomContext[] = [];

  constructor(
    id: string,
    name: string = id,
    protocols: MessageProtocols = OPAQUE_PROTOCOLS
  ) {
    super();
    this.id = id;
    this.name = name;
    this.protocols = protocols;
  }

  get lastContext(): RoomContext {
    const context = this.contexts.at(-1);
    if (context === undefined) {
      throw new Error("No room context was recorded.");
    }

    return context;
  }

  get connected(): string[] {
    return this.clients.map(
      (client) => client.id
    );
  }

  override onClientConnect(
    client: ClientHandle,
    _peer: RoomPeer,
    context: RoomContext
  ): void {
    this.clients.push(client);
    this.contexts.push(context);
  }

  override onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): void {
    this.disconnected.push(clientId);
    this.contexts.push(context);
  }

  override onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    this.messages.push({
      clientId,
      payload
    });
    this.contexts.push(context);
  }
}
