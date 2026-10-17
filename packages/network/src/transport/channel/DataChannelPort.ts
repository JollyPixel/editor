// Import Internal Dependencies
import type {
  ChannelPort,
  ChannelPortListener
} from "./ChannelPort.ts";

// CONSTANTS
const kMoreFrame = "+";
const kLastFrame = ".";
const kDefaultFrameLength = 8_192;
const kDefaultHighWaterMark = 1024 * 1024;
const kDefaultMaxMessageLength = 16 * 1024 * 1024;
const kMinFrameLength = 2;

export type DataChannelState =
  | "connecting"
  | "open"
  | "closing"
  | "closed";

export interface DataChannelLike {
  readonly readyState: DataChannelState;
  readonly bufferedAmount: number;
  bufferedAmountLowThreshold: number;

  send(
    data: string
  ): void;

  close(): void;

  addEventListener(
    type: "message",
    listener: (event: { data: unknown; }) => void
  ): void;
  addEventListener(
    type: "open" | "close" | "bufferedamountlow",
    listener: () => void
  ): void;
}

export interface DataChannelPortOptions {
  /**
   * Most UTF-16 code units one frame carries, at least 2. A frame of 8,192
   * units weighs at most 24 KiB once encoded as UTF-8.
   * @default 8192
   */
  frameLength?: number;
  /**
   * `bufferedAmount`, in bytes, above which frames wait in the port until the
   * channel drains to half of it.
   * @default 1048576
   */
  highWaterMark?: number;
  /**
   * Longest message accepted, in UTF-16 code units of its JSON. A longer or
   * malformed message closes the channel.
   * @default 16777216
   */
  maxMessageLength?: number;
}

export class DataChannelPort implements ChannelPort {
  readonly #channel: DataChannelLike;
  readonly #frameLength: number;
  readonly #highWaterMark: number;
  readonly #maxMessageLength: number;
  readonly #listeners = new Set<ChannelPortListener>();
  readonly #pending: unknown[] = [];
  #outgoing: string[] = [];
  #incoming: string[] = [];
  #incomingLength = 0;
  #started = false;
  #closed = false;

  constructor(
    channel: DataChannelLike,
    options: DataChannelPortOptions = {}
  ) {
    const {
      frameLength = kDefaultFrameLength,
      highWaterMark = kDefaultHighWaterMark,
      maxMessageLength = kDefaultMaxMessageLength
    } = options;
    if (!Number.isInteger(frameLength) || frameLength < kMinFrameLength) {
      throw new RangeError(
        `frameLength must be an integer of at least ${kMinFrameLength}`
      );
    }

    this.#channel = channel;
    this.#frameLength = frameLength;
    this.#highWaterMark = highWaterMark;
    this.#maxMessageLength = maxMessageLength;
    this.#closed = channel.readyState === "closing" ||
      channel.readyState === "closed";

    channel.bufferedAmountLowThreshold = Math.floor(highWaterMark / 2);
    channel.addEventListener("message", (event) => this.#receive(event.data));
    channel.addEventListener("open", () => this.#flush());
    channel.addEventListener("bufferedamountlow", () => this.#flush());
    channel.addEventListener("close", () => this.#release());
  }

  get closed(): boolean {
    return this.#closed;
  }

  postMessage(
    message: unknown
  ): void {
    if (this.#closed) {
      return;
    }

    const json = JSON.stringify(message);
    let start = 0;
    do {
      let end = Math.min(start + this.#frameLength, json.length);
      if (end < json.length && isHighSurrogate(json.charCodeAt(end - 1))) {
        end--;
      }
      const flag = end === json.length ? kLastFrame : kMoreFrame;
      this.#outgoing.push(flag + json.slice(start, end));
      start = end;
    } while (start < json.length);

    this.#flush();
  }

  addEventListener(
    _type: "message",
    listener: ChannelPortListener
  ): void {
    this.#listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: ChannelPortListener
  ): void {
    this.#listeners.delete(listener);
  }

  start(): void {
    if (this.#started) {
      return;
    }

    this.#started = true;
    for (const message of this.#pending.splice(0)) {
      this.#dispatch(message);
    }
  }

  close(): void {
    if (this.#closed) {
      return;
    }

    this.#release();
    this.#channel.close();
  }

  #flush(): void {
    let sent = 0;
    while (
      sent < this.#outgoing.length &&
      this.#channel.readyState === "open" &&
      this.#channel.bufferedAmount <= this.#highWaterMark
    ) {
      this.#channel.send(this.#outgoing[sent]);
      sent++;
    }
    this.#outgoing.splice(0, sent);
  }

  #receive(
    data: unknown
  ): void {
    if (this.#closed) {
      return;
    }

    const flag = typeof data === "string" ? data[0] : undefined;
    if (
      typeof data !== "string" ||
      (flag !== kMoreFrame && flag !== kLastFrame)
    ) {
      this.close();

      return;
    }

    this.#incomingLength += data.length - 1;
    if (this.#incomingLength > this.#maxMessageLength) {
      this.close();

      return;
    }
    this.#incoming.push(data.slice(1));
    if (flag === kMoreFrame) {
      return;
    }

    const json = this.#incoming.join("");
    this.#incoming = [];
    this.#incomingLength = 0;
    let message: unknown;
    try {
      message = JSON.parse(json);
    }
    catch {
      this.close();

      return;
    }

    if (this.#started) {
      this.#dispatch(message);
    }
    else {
      this.#pending.push(message);
    }
  }

  #dispatch(
    message: unknown
  ): void {
    for (const listener of [...this.#listeners]) {
      listener({ data: message });
    }
  }

  #release(): void {
    this.#closed = true;
    this.#outgoing = [];
    this.#incoming = [];
    this.#incomingLength = 0;
    this.#pending.length = 0;
  }
}

function isHighSurrogate(
  code: number
): boolean {
  return code >= 0xD800 && code <= 0xDBFF;
}
