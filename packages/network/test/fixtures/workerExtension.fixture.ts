// Import Internal Dependencies
import {
  Extension,
  type ClientHandle,
  type RoomContext,
  type RoomPeer
} from "#src/index.ts";
import { OPAQUE_PROTOCOLS } from "../helpers/protocols.ts";

export interface FixtureWorkerData {
  greeting?: string;
}

/**
 * Real Extension used by the worker_threads e2e test — exercises the actual
 * dynamic import + construction + RPC round-trip a worker-mode registration
 * goes through, as opposed to WorkerExtensionProxy.spec.ts's FakeWorkerTransport.
 */
export default class FixtureExtension extends Extension {
  readonly protocols = OPAQUE_PROTOCOLS;
  readonly id = "fixture";
  readonly name = "fixture";

  #greeting: string;

  constructor(
    workerData?: FixtureWorkerData
  ) {
    super();
    this.#greeting = workerData?.greeting ?? "hello";
  }

  override onClientConnect(
    client: ClientHandle,
    peer: RoomPeer,
    context: RoomContext
  ): void {
    client.send({
      type: "welcome",
      greeting: this.#greeting,
      username: peer.profile.username,
      subject: context.identity.subject
    });
  }

  override onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): void {
    context.room.sendTo(clientId, { type: "bye" });
  }

  override onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    if (payload && typeof payload === "object" && "compute" in payload) {
      let total = 0;
      for (let i = 0; i < 1_000_000; i++) {
        total += i;
      }
      context.room.broadcast({ type: "result", total });

      return;
    }

    context.room.sendTo(clientId, {
      type: "echo",
      role: context.identity.role
    });
  }
}
