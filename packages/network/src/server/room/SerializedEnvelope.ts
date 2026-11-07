// Import Internal Dependencies
import type { Envelope } from "../../protocol/envelope/Envelope.ts";
import {
  encodeFrame,
  type Frame
} from "../../protocol/frame/Frame.ts";
import type { ConnectedClient } from "../connection/ConnectedClient.ts";

export class SerializedEnvelope {
  #envelope: Envelope;
  #frame: Frame | undefined;

  constructor(
    envelope: Envelope
  ) {
    this.#envelope = envelope;
  }

  sendTo(
    handle: ConnectedClient
  ): void {
    this.#frame ??= encodeFrame(this.#envelope);
    handle.sendFrame(this.#frame);
  }
}
