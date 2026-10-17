// Import Internal Dependencies
import type { Envelope } from "../../protocol/envelope/Envelope.ts";
import type { ClientHandle } from "../../transport/ClientHandle.ts";

export class SerializedEnvelope {
  #envelope: Envelope;
  #json: string | undefined;

  constructor(
    envelope: Envelope
  ) {
    this.#envelope = envelope;
  }

  sendTo(
    handle: ClientHandle
  ): void {
    if (handle.sendSerialized === undefined) {
      handle.send(this.#envelope);

      return;
    }

    this.#json ??= JSON.stringify(this.#envelope);
    handle.sendSerialized(this.#json);
  }
}
