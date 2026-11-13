// Import Third-party Dependencies
import {
  mockAssetRoom,
  type AssetServerMessage,
  type MockAssetRoom
} from "@jolly-pixel/asset-server/testing";

// CONSTANTS
const kGolem = "golem";

export interface StudioServer<TCommand, TSnapshot> {
  connect(
    clientId: string
  ): Promise<void>;
  receive(
    clientId: string,
    payload: unknown
  ): Promise<void>;
  take(
    clientId: string
  ): AssetServerMessage<TCommand, TSnapshot>[];
}

export class MockStudio<
  TServer extends StudioServer<TCommand, TSnapshot>,
  TCommand,
  TSnapshot
> {
  readonly server: TServer;
  readonly room: MockAssetRoom<TCommand, TSnapshot> = mockAssetRoom(kGolem);

  constructor(
    server: TServer
  ) {
    this.server = server;
  }

  async connect(): Promise<void> {
    await this.server.connect(kGolem);
    this.deliver();
  }

  deliver(): void {
    for (const message of this.server.take(kGolem)) {
      this.room.deliver(message);
    }
  }

  async answer(): Promise<void> {
    for (const sent of this.room.sent.splice(0)) {
      await this.server.receive(kGolem, sent);
    }
    this.deliver();
  }
}
