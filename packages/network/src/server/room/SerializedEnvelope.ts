// Import Internal Dependencies
import type { Envelope } from "../../protocol/envelope/Envelope.ts";
import type { ConnectedClient } from "../connection/ConnectedClient.ts";

export class SerializedEnvelope {
  #envelope: Envelope;
  #json: string | undefined;

  constructor(
    envelope: Envelope
  ) {
    this.#envelope = envelope;
  }

  sendTo(
    handle: ConnectedClient
  ): void {
    this.#json ??= JSON.stringify(this.#envelope);
    handle.sendSerialized(this.#json);
  }
}
