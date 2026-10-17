// Import Node.js Dependencies
import { setImmediate } from "node:timers";

// Import Internal Dependencies
import type {
  DataChannelLike,
  DataChannelState
} from "#src/transport/channel/DataChannelPort.ts";

// CONSTANTS
const kEncoder = new TextEncoder();
const kDecoder = new TextDecoder();

type DataChannelEventType = "message" | "open" | "close" | "bufferedamountlow";
type DataChannelListener = (event: { data: unknown; }) => void;

export class FakeDataChannel implements DataChannelLike {
  readyState: DataChannelState;
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  readonly inFlight: string[] = [];
  readonly sent: string[] = [];
  peer: FakeDataChannel | null = null;
  autoDeliver: boolean;

  readonly #listeners = new Map<DataChannelEventType, Set<DataChannelListener>>();

  constructor(
    options: { state?: DataChannelState; autoDeliver?: boolean; } = {}
  ) {
    this.readyState = options.state ?? "open";
    this.autoDeliver = options.autoDeliver ?? true;
  }

  send(
    data: string
  ): void {
    if (this.readyState !== "open") {
      throw new Error("InvalidStateError: the data channel is not open");
    }

    const bytes = kEncoder.encode(data);
    this.sent.push(data);
    this.inFlight.push(kDecoder.decode(bytes));
    this.bufferedAmount += bytes.byteLength;
    if (this.autoDeliver) {
      setImmediate(() => this.deliver());
    }
  }

  deliver(
    count = Number.POSITIVE_INFINITY
  ): void {
    for (let index = 0; index < count && this.inFlight.length > 0; index++) {
      const data = this.inFlight.shift()!;
      const before = this.bufferedAmount;
      this.bufferedAmount -= kEncoder.encode(data).byteLength;
      this.peer?.receive(data);
      if (
        before > this.bufferedAmountLowThreshold &&
        this.bufferedAmount <= this.bufferedAmountLowThreshold
      ) {
        this.#emit("bufferedamountlow");
      }
    }
  }

  receive(
    data: unknown
  ): void {
    if (this.readyState === "open") {
      this.#emit("message", data);
    }
  }

  open(): void {
    this.readyState = "open";
    this.#emit("open");
  }

  close(): void {
    if (this.readyState === "closed") {
      return;
    }

    this.readyState = "closed";
    this.inFlight.length = 0;
    this.#emit("close");
    this.peer?.close();
  }

  addEventListener(
    type: DataChannelEventType,
    listener: DataChannelListener
  ): void {
    const registered = this.#listeners.get(type) ?? new Set();
    registered.add(listener);
    this.#listeners.set(type, registered);
  }

  #emit(
    type: DataChannelEventType,
    data?: unknown
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener({ data });
    }
  }
}

export function fakeDataChannelPair(
  options: { autoDeliver?: boolean; } = {}
): [FakeDataChannel, FakeDataChannel] {
  const local = new FakeDataChannel(options);
  const remote = new FakeDataChannel(options);
  local.peer = remote;
  remote.peer = local;

  return [local, remote];
}
