// Import Internal Dependencies
import type {
  ChannelPort,
  ChannelPortListener
} from "./ChannelPort.ts";
import {
  decodeFrame,
  encodeFrame,
  type ReceivedFrame
} from "../../protocol/frame/Frame.ts";

// CONSTANTS
const kLastChunk = 1;
const kTextChunk = 2;
const kChunkFlags = kLastChunk | kTextChunk;
const kDefaultChunkLength = 16_384;
const kDefaultHighWaterMark = 1024 * 1024;
const kDefaultMaxMessageLength = 16 * 1024 * 1024;
const kUtf8Encoder = new TextEncoder();
const kUtf8Decoder = new TextDecoder("utf-8", { fatal: true });

export type DataChannelState =
  | "connecting"
  | "open"
  | "closing"
  | "closed";

export interface DataChannelLike {
  readonly readyState: DataChannelState;
  readonly bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  binaryType: BinaryType;

  send(
    data: Uint8Array<ArrayBuffer>
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
   * Most message bytes one chunk carries after its flag byte, at least 1.
   * @default 16384
   */
  chunkLength?: number;
  /**
   * `bufferedAmount`, in bytes, above which chunks wait in the port until the
   * channel drains to half of it.
   * @default 1048576
   */
  highWaterMark?: number;
  /**
   * Longest message accepted, in bytes. A longer or malformed message closes
   * the channel.
   * @default 16777216
   */
  maxMessageLength?: number;
}

export class DataChannelPort implements ChannelPort {
  readonly #channel: DataChannelLike;
  readonly #chunkLength: number;
  readonly #highWaterMark: number;
  readonly #maxMessageLength: number;
  readonly #listeners = new Set<ChannelPortListener>();
  readonly #pending: unknown[] = [];
  #outgoing: Uint8Array<ArrayBuffer>[] = [];
  #incoming: Uint8Array[] = [];
  #incomingLength = 0;
  #started = false;
  #closed = false;

  constructor(
    channel: DataChannelLike,
    options: DataChannelPortOptions = {}
  ) {
    const {
      chunkLength = kDefaultChunkLength,
      highWaterMark = kDefaultHighWaterMark,
      maxMessageLength = kDefaultMaxMessageLength
    } = options;
    if (!Number.isInteger(chunkLength) || chunkLength < 1) {
      throw new RangeError("chunkLength must be a positive integer");
    }

    this.#channel = channel;
    this.#chunkLength = chunkLength;
    this.#highWaterMark = highWaterMark;
    this.#maxMessageLength = maxMessageLength;
    this.#closed = channel.readyState === "closing" ||
      channel.readyState === "closed";

    channel.bufferedAmountLowThreshold = Math.floor(highWaterMark / 2);
    channel.binaryType = "arraybuffer";
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

    const frame = encodeFrame(message);
    const text = typeof frame === "string";
    const bytes = text ? kUtf8Encoder.encode(frame) : frame;
    const kind = text ? kTextChunk : 0;
    let start = 0;
    do {
      const end = Math.min(start + this.#chunkLength, bytes.byteLength);
      const chunk = new Uint8Array(1 + end - start);
      chunk[0] = kind | (end === bytes.byteLength ? kLastChunk : 0);
      chunk.set(bytes.subarray(start, end), 1);
      this.#outgoing.push(chunk);
      start = end;
    } while (start < bytes.byteLength);

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
    const chunk = asBytes(data);
    const flags = chunk?.at(0);
    if (
      chunk === null ||
      flags === undefined ||
      (flags & ~kChunkFlags) !== 0
    ) {
      this.close();

      return;
    }

    const payload = chunk.subarray(1);
    this.#incomingLength += payload.byteLength;
    if (this.#incomingLength > this.#maxMessageLength) {
      this.close();

      return;
    }
    this.#incoming.push(payload);
    if ((flags & kLastChunk) === 0) {
      return;
    }

    const frame = joinChunks(
      this.#incoming,
      this.#incomingLength,
      (flags & kTextChunk) !== 0
    );
    this.#incoming = [];
    this.#incomingLength = 0;
    const decoded = frame === null ? null : decodeFrame(frame);
    if (decoded === null || !decoded.ok) {
      this.close();

      return;
    }

    const message = decoded.val;
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

function asBytes(
  data: unknown
): Uint8Array | null {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  return data instanceof Uint8Array ? data : null;
}

function joinChunks(
  chunks: readonly Uint8Array[],
  length: number,
  text: boolean
): ReceivedFrame | null {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!text) {
    return bytes;
  }

  try {
    return kUtf8Decoder.decode(bytes);
  }
  catch {
    return null;
  }
}
