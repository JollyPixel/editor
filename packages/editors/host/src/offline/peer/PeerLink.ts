// Import Third-party Dependencies
import { DataChannelPort } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { PeerConnectionError } from "./errors/PeerConnectionError.ts";
import type {
  PeerSignal,
  PeerSignaling
} from "./signaling/PeerSignaling.ts";

// CONSTANTS
const kChannelLabel = "jolly-pixel";
const kChannelId = 0;
const kConnectTimeoutMs = 20_000;

export interface PeerLinkOptions {
  signaling: PeerSignaling;
  remote: string;
  session: string;
  iceServers?: RTCIceServer[];
}

export class PeerLink {
  static async offer(
    options: PeerLinkOptions
  ): Promise<PeerLink> {
    const link = new PeerLink(options);
    await link.#connect(async() => {
      await link.#connection.setLocalDescription();
      link.#sendDescription("offer");
    });

    return link;
  }

  static async answer(
    options: PeerLinkOptions & { offer: string; }
  ): Promise<PeerLink> {
    const link = new PeerLink(options);
    await link.#connect(async() => {
      await link.#applyRemote({
        type: "offer",
        sdp: options.offer
      });
      await link.#connection.setLocalDescription();
      link.#sendDescription("answer");
    });

    return link;
  }

  readonly remote: string;
  readonly session: string;
  readonly port: DataChannelPort;
  readonly closed: Promise<void>;

  readonly #signaling: PeerSignaling;
  readonly #connection: RTCPeerConnection;
  readonly #channel: RTCDataChannel;
  readonly #unsubscribe: () => void;
  readonly #remoteReady = Promise.withResolvers<void>();
  readonly #ended = Promise.withResolvers<void>();
  #done = false;

  constructor(
    options: PeerLinkOptions
  ) {
    this.remote = options.remote;
    this.session = options.session;
    this.closed = this.#ended.promise;
    this.#signaling = options.signaling;
    this.#connection = new RTCPeerConnection({
      iceServers: options.iceServers ?? []
    });
    this.#channel = this.#connection.createDataChannel(kChannelLabel, {
      negotiated: true,
      id: kChannelId,
      ordered: true
    });
    this.port = new DataChannelPort(this.#channel);

    this.#connection.addEventListener("icecandidate", ({ candidate }) => {
      if (candidate !== null && candidate.candidate !== "") {
        this.#send({
          type: "candidate",
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment
        });
      }
    });
    this.#connection.addEventListener("connectionstatechange", () => {
      const state = this.#connection.connectionState;
      if (state === "failed" || state === "closed") {
        this.close();
      }
    });
    this.#channel.addEventListener("close", () => this.close());
    this.#unsubscribe = this.#signaling.subscribe((message) => {
      if (
        message.from === this.remote &&
        message.session === this.session
      ) {
        this.#receive(message.signal);
      }
    });
  }

  close(): void {
    if (this.#done) {
      return;
    }

    this.#done = true;
    this.#unsubscribe();
    this.port.close();
    this.#connection.close();
    this.#ended.resolve();
  }

  async #connect(
    negotiate: () => Promise<void>
  ): Promise<void> {
    const opened = Promise.withResolvers<void>();
    opened.promise.catch(() => undefined);
    this.#channel.addEventListener("open", () => opened.resolve());
    void this.closed.then(() => opened.reject(
      new PeerConnectionError("The peer connection closed before it opened.")
    ));
    const timer = setTimeout(() => opened.reject(
      new PeerConnectionError("The peer did not answer in time.")
    ), kConnectTimeoutMs);

    try {
      await negotiate();
      await opened.promise;
    }
    catch (error) {
      this.close();

      throw error;
    }
    finally {
      clearTimeout(timer);
    }
  }

  #receive(
    signal: PeerSignal
  ): void {
    if (signal.type === "answer") {
      this.#applyRemote(signal).catch(() => this.close());
    }
    else if (signal.type === "candidate") {
      this.#remoteReady.promise
        .then(() => this.#connection.addIceCandidate(signal))
        .catch(() => undefined);
    }
  }

  async #applyRemote(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    await this.#connection.setRemoteDescription(description);
    this.#remoteReady.resolve();
  }

  #sendDescription(
    type: "offer" | "answer"
  ): void {
    const sdp = this.#connection.localDescription?.sdp;
    if (sdp === undefined) {
      throw new PeerConnectionError(`No local ${type} to send.`);
    }

    this.#send({
      type,
      sdp
    });
  }

  #send(
    signal: PeerSignal
  ): void {
    if (!this.#done) {
      this.#signaling.send({
        to: this.remote,
        session: this.session,
        signal
      });
    }
  }
}
