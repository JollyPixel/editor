// Import Internal Dependencies
import {
  Extension,
  type ClientHandle,
  type PeerMetadata,
  type RoomContext
} from "#src/index.ts";

export interface FixtureWorkerData {
  greeting?: string;
}

/**
 * Real Extension used by the worker_threads e2e test — exercises the actual
 * dynamic import + construction + RPC round-trip a worker-mode registration
 * goes through, as opposed to WorkerExtensionProxy.spec.ts's FakeWorkerTransport.
 */
export default class FixtureExtension extends Extension {
  readonly id = "fixture";
  readonly name = "fixture";

  #greeting: string;

  constructor(
    workerData?: FixtureWorkerData
  ) {
    super();
    this.#greeting = workerData?.greeting ?? "hello";
  }

  async onClientConnect(
    client: ClientHandle,
    identity: PeerMetadata,
    context: RoomContext
  ): Promise<void> {
    client.send({ type: "welcome", greeting: this.#greeting });
    await context.eventStore.append({
      assetType: "fixture",
      assetId: client.id,
      eventType: "connected",
      eventData: identity
    });
  }

  onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): void {
    context.room.sendTo(clientId, { type: "bye" });
  }

  async onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): Promise<void> {
    if (payload && typeof payload === "object" && "compute" in payload) {
      let total = 0;
      for (let i = 0; i < 1_000_000; i++) {
        total += i;
      }
      context.room.broadcast({ type: "result", total });

      return;
    }

    const events = await context.eventStore.list(clientId);
    context.room.sendTo(clientId, { type: "history", count: events.length });
  }
}
